import { useRef, useState, useEffect, useCallback } from 'react';
import previewManager from '../lib/previewManager';

// "pointer: coarse" is the reliable touch-device signal.
// Avoids the Android bug where hover:hover sometimes returns true.
const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

const HOVER_DELAY      = 200;  // ms — desktop intent threshold
const TOUCH_DELAY      = 150;  // ms — mobile intent threshold
const SCROLL_THRESHOLD = 15;   // px — movement that means "scrolling, not tapping"

// ─────────────────────────────────────────────────────────────────────────────
// useVideoPreview(videoId, previewUrl, onNavigate)
//
// Returns:
//   containerProps  — spread onto the card wrapper div
//   videoProps      — spread onto the <video> element
//   isPlaying       — whether preview is currently playing
//   onCardClick     — click handler (desktop: navigate; mobile: tap logic)
// ─────────────────────────────────────────────────────────────────────────────
export function useVideoPreview(videoId, previewUrl, onNavigate) {
  const videoRef   = useRef(null);
  const wrapperRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const delayTimer   = useRef(null);
  const touchOrigin  = useRef(null);  // { x, y } while touch is active
  const previewArmed = useRef(false); // did THIS touch session start a preview?
  const isVisible    = useRef(false);

  // ── Release all video resources ─────────────────────────────────────────
  const releaseVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    v.src = '';
    v.load();
  }, []);

  // ── Stop handler — stored in previewManager ──────────────────────────────
  const doStop = useCallback(() => {
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  // ── Start preview ────────────────────────────────────────────────────────
  const doStart = useCallback(() => {
    if (!previewUrl || !isVisible.current) return;
    previewArmed.current = true;
    previewManager.start(videoId, doStop);
    const v = videoRef.current;
    if (!v) return;
    // Only set src when actually starting — keeps network idle until needed.
    if (!v.src) v.src = previewUrl;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [videoId, previewUrl, doStop]);

  // ── IntersectionObserver: ≥50 % visible to play, <50 % to stop ──────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.intersectionRatio >= 0.5;
        if (!isVisible.current && previewManager.current === videoId) {
          clearTimeout(delayTimer.current);
          previewManager.stop(videoId);
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [videoId]);

  // ── Mobile: stop when the page scrolls while preview is playing ──────────
  //
  // After touchend the preview intentionally keeps running.
  // A window "scroll" event fires as soon as the next scroll gesture moves
  // the page — that's our signal to stop.
  useEffect(() => {
    if (!IS_TOUCH || !isPlaying) return;
    const onScroll = () => previewManager.stop(videoId);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPlaying, videoId]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(delayTimer.current);
      if (previewManager.current === videoId) previewManager.stop(videoId);
      releaseVideo();
    };
  }, [videoId, releaseVideo]);

  // ── Desktop: mouseenter / mouseleave ────────────────────────────────────
  const onMouseEnter = useCallback(() => {
    if (IS_TOUCH || !previewUrl) return;
    clearTimeout(delayTimer.current);
    delayTimer.current = setTimeout(doStart, HOVER_DELAY);
  }, [previewUrl, doStart]);

  const onMouseLeave = useCallback(() => {
    if (IS_TOUCH) return;
    clearTimeout(delayTimer.current);
    if (previewManager.current === videoId) previewManager.stop(videoId);
  }, [videoId]);

  // ── Mobile: touchstart ───────────────────────────────────────────────────
  //
  // Records touch origin and arms the 150 ms delay timer.
  // previewArmed is reset here so the click handler knows whether
  // THIS touch session started a preview or was a quick tap.
  const onTouchStart = useCallback((e) => {
    if (!previewUrl) return;
    previewArmed.current = false;
    const t = e.touches[0];
    touchOrigin.current = { x: t.clientX, y: t.clientY };
    clearTimeout(delayTimer.current);
    delayTimer.current = setTimeout(doStart, TOUCH_DELAY);
  }, [previewUrl, doStart]);

  // ── Mobile: touchmove ────────────────────────────────────────────────────
  //
  // HOW SCROLL DETECTION WORKS:
  //
  // While a touch is active we continuously compare the current finger
  // position against where the touch began (touchOrigin).
  //
  // If either axis exceeds SCROLL_THRESHOLD (15 px):
  //   → The gesture is a scroll, not a tap
  //   → Cancel the pending delay timer (preview never starts)
  //   → If the preview somehow already started, stop it immediately
  //   → Null-out touchOrigin so subsequent moves are ignored
  //
  // This covers two phases:
  //   Phase 1 – during the 150 ms delay: timer is cancelled, no preview starts
  //   Phase 2 – if preview is already playing: preview is stopped mid-scroll
  //
  // After touchend the touch origin is gone; further scroll is caught by
  // the window "scroll" listener added when isPlaying becomes true.
  const onTouchMove = useCallback((e) => {
    if (!touchOrigin.current) return;
    const t  = e.touches[0];
    const dx = Math.abs(t.clientX - touchOrigin.current.x);
    const dy = Math.abs(t.clientY - touchOrigin.current.y);
    if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) {
      touchOrigin.current = null;
      clearTimeout(delayTimer.current);
      if (previewManager.current === videoId) previewManager.stop(videoId);
    }
  }, [videoId]);

  // touchend — intentionally not handled. Preview keeps playing after lift.

  // ── Click / tap handler ──────────────────────────────────────────────────
  //
  // Desktop: always navigate (hover already showed preview).
  //
  // Mobile tap logic:
  //   • Quick tap (< 150 ms) — previewArmed stays false  → navigate
  //   • Long tap  (≥ 150 ms) — previewArmed becomes true → keep preview, don't navigate
  //   • Second tap on active card                         → stop + navigate
  const onCardClick = useCallback(() => {
    if (!IS_TOUCH) {
      onNavigate?.();
      return;
    }
    if (previewManager.current === videoId) {
      // Already previewing → second tap → navigate
      previewManager.stop(videoId);
      onNavigate?.();
    } else if (!previewArmed.current) {
      // Quick tap, no preview started → navigate
      onNavigate?.();
    }
    // Long tap that started a preview → do nothing; preview keeps playing
  }, [videoId, onNavigate]);

  // ── Video element events ─────────────────────────────────────────────────
  const onPlay  = useCallback(() => setIsPlaying(true),  []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onError = useCallback(() => {
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  // ── Assembled prop bags ──────────────────────────────────────────────────
  const containerProps = {
    ref: wrapperRef,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
  };

  const videoProps = {
    ref: videoRef,
    muted:      true,
    loop:       true,
    playsInline: true,
    preload:    'none',
    onPlay,
    onPause,
    onError,
  };

  return { containerProps, videoProps, isPlaying, onCardClick };
}
