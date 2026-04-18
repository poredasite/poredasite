import { useRef, useState, useEffect, useCallback } from 'react';
import previewManager from '../lib/previewManager';

const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

const HOVER_DELAY      = 200;
const TOUCH_DELAY      = 150;
const SCROLL_THRESHOLD = 15;

// ─────────────────────────────────────────────────────────────────────────────
// useVideoPreview(videoId, previewUrl, onNavigate)
// ─────────────────────────────────────────────────────────────────────────────
export function useVideoPreview(videoId, previewUrl, onNavigate) {
  const videoRef   = useRef(null);
  const wrapperRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const delayTimer   = useRef(null);
  const touchOrigin  = useRef(null);   // { x, y } while touch active, null when cancelled
  const previewArmed = useRef(false);  // did this touch session officially commit a preview?
  const isVisible    = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Synchronous viewport check — fallback when IntersectionObserver hasn't fired yet.
  const isInViewport = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return false;
    const r  = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.height === 0) return false;
    const visH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return visH / r.height >= 0.5;
  }, []);

  // ── Release all video resources ───────────────────────────────────────────
  // Use removeAttribute('src') — NOT v.src = '' — so v.load() does NOT fire
  // an error event that could race-condition with a subsequent play attempt.
  const releaseVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    v.removeAttribute('src');
    v.load();
  }, []);

  // ── Stop handler — stored in previewManager ───────────────────────────────
  const doStop = useCallback(() => {
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  // ── Officially commit this card as the active preview ─────────────────────
  // Called 150 ms after touch (or immediately for desktop).
  // Sets previewArmed so click handler knows not to navigate.
  const commitPreview = useCallback(() => {
    previewArmed.current = true;
    previewManager.start(videoId, doStop);
  }, [videoId, doStop]);

  // ── IntersectionObserver ──────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Seed synchronously so first-touch on visible cards works immediately.
    const r  = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    isVisible.current = r.height > 0 &&
      (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height >= 0.5;

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

  // ── Mobile: stop when user scrolls while preview is playing ───────────────
  // After touchend, the preview keeps running. A new scroll gesture fires the
  // window 'scroll' event — that's our stop signal.
  useEffect(() => {
    if (!IS_TOUCH || !isPlaying) return;
    const stop = () => previewManager.stop(videoId);
    window.addEventListener('scroll', stop, { passive: true });
    return () => window.removeEventListener('scroll', stop);
  }, [isPlaying, videoId]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(delayTimer.current);
      if (previewManager.current === videoId) previewManager.stop(videoId);
      else releaseVideo();
    };
  }, [videoId, releaseVideo]);

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP handlers
  // ─────────────────────────────────────────────────────────────────────────

  const onMouseEnter = useCallback(() => {
    if (IS_TOUCH || !previewUrl) return;
    clearTimeout(delayTimer.current);
    delayTimer.current = setTimeout(() => {
      if (!isVisible.current && !isInViewport()) return;
      previewArmed.current = true;
      previewManager.start(videoId, doStop);
      const v = videoRef.current;
      if (!v) return;
      if (!v.getAttribute('src')) v.src = previewUrl;
      v.currentTime = 0;
      v.play().catch(() => {});
    }, HOVER_DELAY);
  }, [previewUrl, videoId, doStop, isInViewport]);

  const onMouseLeave = useCallback(() => {
    if (IS_TOUCH) return;
    clearTimeout(delayTimer.current);
    if (previewManager.current === videoId) previewManager.stop(videoId);
  }, [videoId]);

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE handlers
  //
  // WHY play() is called inside onTouchStart (user gesture):
  //   iOS Safari requires a user-gesture context for video.play() even on
  //   muted video in some versions. A setTimeout callback is NOT a gesture.
  //   Calling play() directly in the touchstart handler guarantees it works.
  //
  // HOW SCROLL DETECTION WORKS:
  //   Phase 1 — during 150 ms delay:
  //     touchmove watches Δx/Δy against touchOrigin. If either exceeds
  //     SCROLL_THRESHOLD (15 px) the gesture is classified as a scroll:
  //     timer is cancelled, video is paused and released, touchOrigin set
  //     to null so further moves are ignored.
  //
  //   Phase 2 — after preview is playing (even after touchend):
  //     A window 'scroll' listener (added while isPlaying === true) fires
  //     on the first scroll event and stops the active preview.
  // ─────────────────────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e) => {
    if (!previewUrl) return;
    previewArmed.current = false;
    const t = e.touches[0];
    touchOrigin.current = { x: t.clientX, y: t.clientY };
    clearTimeout(delayTimer.current);

    const v = videoRef.current;
    if (!v) return;

    // Stop whatever is currently playing so we don't have two videos loading.
    if (previewManager.current && previewManager.current !== videoId) {
      previewManager.stop(previewManager.current);
    }

    // Set src and call play() HERE — inside the user gesture — for iOS.
    if (!v.getAttribute('src')) v.src = previewUrl;
    v.currentTime = 0;
    v.play().catch(() => {});

    // After TOUCH_DELAY with no scroll → officially register with manager.
    delayTimer.current = setTimeout(() => {
      if (!touchOrigin.current) return; // scroll cancelled
      commitPreview();
    }, TOUCH_DELAY);
  }, [previewUrl, videoId, commitPreview]);

  const onTouchMove = useCallback((e) => {
    if (!touchOrigin.current) return;
    const t  = e.touches[0];
    const dx = Math.abs(t.clientX - touchOrigin.current.x);
    const dy = Math.abs(t.clientY - touchOrigin.current.y);
    if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) {
      touchOrigin.current = null;
      clearTimeout(delayTimer.current);
      // If already committed to manager, stop via manager. Otherwise release directly.
      if (previewManager.current === videoId) previewManager.stop(videoId);
      else releaseVideo();
    }
  }, [videoId, releaseVideo]);

  // touchend — intentionally NOT handled. Preview keeps playing after lift.

  // ── Click / tap navigation ────────────────────────────────────────────────
  //
  // Desktop: always navigate (hover already handles the preview).
  //
  // Mobile tap logic:
  //   • Quick tap  (< 150 ms, previewArmed=false) → navigate directly
  //   • Long hold  (≥ 150 ms, previewArmed=true)  → keep preview, don't navigate
  //   • Second tap on already-previewing card      → stop + navigate
  const onCardClick = useCallback(() => {
    if (!IS_TOUCH) {
      onNavigate?.();
      return;
    }
    if (previewManager.current === videoId) {
      // Already showing this preview → second tap → navigate
      previewManager.stop(videoId);
      onNavigate?.();
    } else if (!previewArmed.current) {
      // Quick tap that never started a preview → navigate
      onNavigate?.();
    }
    // else: long-hold started preview, user lifted finger → keep playing
  }, [videoId, onNavigate]);

  // ── Video element events ──────────────────────────────────────────────────
  const onPlay  = useCallback(() => setIsPlaying(true),  []);
  const onPause = useCallback(() => setIsPlaying(false), []);

  // Only handle errors when a real src is loaded — not the no-op error that
  // fires from v.load() after removeAttribute('src') during cleanup.
  const onError = useCallback(() => {
    if (!videoRef.current?.getAttribute('src')) return;
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  // ─────────────────────────────────────────────────────────────────────────
  const containerProps = { ref: wrapperRef, onMouseEnter, onMouseLeave, onTouchStart, onTouchMove };
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
