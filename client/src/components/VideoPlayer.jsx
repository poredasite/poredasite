import { useRef, useState, useEffect, useCallback } from "react";

export default function VideoPlayer({ src, poster, title }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedToast, setShowSpeedToast] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState(null); // "left" | "right"
  const hideTimer = useRef(null);
  const tapTimer = useRef(null);
  const tapCount = useRef(0);
  const speedToastTimer = useRef(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [playing, resetHideTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (!videoRef.current) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": videoRef.current.currentTime += 10; break;
        case "ArrowLeft": videoRef.current.currentTime -= 10; break;
        case "m": toggleMute(); break;
        case "f": toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    resetHideTimer();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  }

  function setVideoSpeed(s) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
  }

  // Double tap: 2x speed while held, +10s on double tap
  function handleTouchStart(e) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const side = x < rect.width / 2 ? "left" : "right";

    tapCount.current += 1;
    clearTimeout(tapTimer.current);

    if (tapCount.current === 2) {
      tapCount.current = 0;
      // Double tap: seek ±10s
      if (videoRef.current) {
        videoRef.current.currentTime += side === "right" ? 10 : -10;
      }
      setDoubleTapSide(side);
      setTimeout(() => setDoubleTapSide(null), 600);
    } else {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
        // Single tap: show/hide controls or play/pause
        if (showControls) togglePlay();
        else setShowControls(true);
        resetHideTimer();
      }, 250);
    }
  }

  // Long press: 2x speed
  const longPressTimer = useRef(null);
  function handleTouchHoldStart() {
    longPressTimer.current = setTimeout(() => {
      setVideoSpeed(2);
      setShowSpeedToast(true);
      clearTimeout(speedToastTimer.current);
    }, 400);
  }
  function handleTouchHoldEnd() {
    clearTimeout(longPressTimer.current);
    if (speed === 2) {
      setVideoSpeed(1);
      setShowSpeedToast(false);
    }
  }

  function formatTime(s) {
    if (isNaN(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    return `${m}:${String(sec).padStart(2,"0")}`;
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      onTouchStart={(e) => { handleTouchStart(e); handleTouchHoldStart(); }}
      onTouchEnd={handleTouchHoldEnd}
      onTouchCancel={handleTouchHoldEnd}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        preload="metadata"
        onTimeUpdate={() => setCurrent(videoRef.current?.currentTime || 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => { setPlaying(true); setBuffering(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={togglePlay}
        aria-label={title}
      />

      {/* Buffering */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Big play button */}
      {!playing && !buffering && (
        <button onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-brand-500/90 hover:bg-brand-400 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-[0_0_40px_rgba(255,107,0,0.4)]">
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </button>
      )}

      {/* 2x speed toast */}
      {showSpeedToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2 animate-fade-in pointer-events-none">
          <span>⚡</span> 2x Hız
        </div>
      )}

      {/* Double tap ripple */}
      {doubleTapSide && (
        <div className={`absolute inset-y-0 ${doubleTapSide === "right" ? "right-0" : "left-0"} w-1/3 flex items-center justify-center pointer-events-none`}>
          <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center animate-ping">
            <span className="text-white text-2xl font-bold">
              {doubleTapSide === "right" ? "+10" : "-10"}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
        <div className="relative px-4 pb-3 pt-8">
          {/* Progress */}
          <div className="relative mb-3">
            <input type="range" min={0} max={duration || 100} step={0.1} value={currentTime}
              onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
              className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500
                         hover:h-1.5 transition-all"
              style={{ background: `linear-gradient(to right, #ff6b00 ${progress}%, rgba(255,255,255,0.2) ${progress}%)` }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-brand-400 transition-colors p-1">
              {playing
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>

            <button onClick={toggleMute} className="text-white hover:text-brand-400 transition-colors p-1">
              {muted
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              }
            </button>

            <span className="text-white/70 text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>

            <div className="flex-1" />

            {/* Speed selector */}
            <div className="flex items-center gap-1">
              {[0.5, 1, 1.5, 2].map(s => (
                <button key={s} onClick={() => setVideoSpeed(s)}
                  className={`text-xs font-mono px-1.5 py-0.5 rounded transition-all
                    ${speed === s ? "bg-brand-500 text-white" : "text-white/60 hover:text-white"}`}>
                  {s}x
                </button>
              ))}
            </div>

            <button onClick={toggleFullscreen} className="text-white hover:text-brand-400 transition-colors p-1">
              {fullscreen
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
