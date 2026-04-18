import { useRef, useState, useEffect, useCallback } from 'react';
import previewManager from '../lib/previewManager';

const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

const HOVER_DELAY = 200; // desktop only

export function useVideoPreview(videoId, previewUrl, onNavigate) {
  const videoRef   = useRef(null);
  const wrapperRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const desktopTimer   = useRef(null);
  const wasPlayingRef  = useRef(false); // was preview already playing BEFORE this touch?
  const isVisible      = useRef(false);

  // ── Release resources ─────────────────────────────────────────────────────
  // removeAttribute('src') instead of src='' so v.load() doesn't fire a spurious
  // error event that would race-condition against the next play attempt.
  const releaseVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    v.removeAttribute('src');
    v.load();
  }, []);

  // Called by previewManager when another card takes over.
  const doStop = useCallback(() => {
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  // ── Actually play ─────────────────────────────────────────────────────────
  const doPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !previewUrl) return;
    if (!v.getAttribute('src')) v.src = previewUrl;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [previewUrl]);

  // ── IntersectionObserver: seed sync + stop when out of view ──────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Seed synchronously so first-touch on a visible card works immediately.
    const r  = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    isVisible.current = r.height > 0 &&
      (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height >= 0.5;

    const obs = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.intersectionRatio >= 0.5;
      if (!isVisible.current && previewManager.current === videoId) {
        previewManager.stop(videoId);
      }
    }, { threshold: [0, 0.5, 1] });

    obs.observe(el);
    return () => obs.disconnect();
  }, [videoId]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(desktopTimer.current);
      if (previewManager.current === videoId) previewManager.stop(videoId);
      else releaseVideo();
    };
  }, [videoId, releaseVideo]);

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP — hover with 200 ms intent delay
  // ─────────────────────────────────────────────────────────────────────────
  const onMouseEnter = useCallback(() => {
    if (IS_TOUCH || !previewUrl) return;
    clearTimeout(desktopTimer.current);
    desktopTimer.current = setTimeout(() => {
      if (!isVisible.current) return;
      previewManager.start(videoId, doStop);
      doPlay();
    }, HOVER_DELAY);
  }, [previewUrl, videoId, doStop, doPlay]);

  const onMouseLeave = useCallback(() => {
    if (IS_TOUCH) return;
    clearTimeout(desktopTimer.current);
    if (previewManager.current === videoId) previewManager.stop(videoId);
  }, [videoId]);

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE — touchstart = start immediately, touchend = keep playing
  //
  // Logic is intentionally dead-simple:
  //   • Finger touches card  → preview starts right now
  //   • Finger lifts         → preview KEEPS PLAYING (touchend ignored)
  //   • Finger touches again → previewManager stops old, starts new
  //   • Card leaves viewport → IntersectionObserver stops it
  //
  // play() is called inside the touchstart handler (user-gesture context)
  // which is required by iOS Safari for programmatic video playback.
  // ─────────────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e) => {
    if (!previewUrl) return;

    const alreadyActive = previewManager.current === videoId;
    wasPlayingRef.current = alreadyActive;

    if (alreadyActive) {
      // Same card touched again → don't restart, just resume if paused.
      const v = videoRef.current;
      if (v && v.paused) v.play().catch(() => {});
      return;
    }

    // Different card (or first touch) → start from beginning.
    previewManager.start(videoId, doStop);
    doPlay();
  }, [previewUrl, videoId, doStop, doPlay]);

  // touchend → intentionally not handled. Preview keeps playing.

  // ─────────────────────────────────────────────────────────────────────────
  // CLICK / TAP navigation
  //
  // Desktop: always navigate (hover showed the preview).
  //
  // Mobile:
  //   First tap  → touchstart just started preview, wasPlaying=false → keep playing
  //   Second tap → preview was already playing when this touch began  → navigate
  // ─────────────────────────────────────────────────────────────────────────
  const onCardClick = useCallback(() => {
    if (!IS_TOUCH) {
      onNavigate?.();
      return;
    }
    if (wasPlayingRef.current || !previewUrl) {
      // Was already playing → second tap → navigate
      previewManager.stop(videoId);
      onNavigate?.();
    }
    // else: first tap that just started preview → do nothing, keep playing
  }, [videoId, previewUrl, onNavigate]);

  // ── Video element events ──────────────────────────────────────────────────
  const onPlay  = useCallback(() => setIsPlaying(true),  []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onError = useCallback(() => {
    // Ignore the no-src "error" that fires from releaseVideo's v.load() call.
    if (!videoRef.current?.getAttribute('src')) return;
    releaseVideo();
    setIsPlaying(false);
  }, [releaseVideo]);

  const containerProps = {
    ref: wrapperRef,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
  };

  const videoProps = {
    ref: videoRef,
    muted:       true,
    loop:        true,
    playsInline: true,
    preload:     'none',
    onPlay,
    onPause,
    onError,
  };

  return { containerProps, videoProps, isPlaying, onCardClick };
}
