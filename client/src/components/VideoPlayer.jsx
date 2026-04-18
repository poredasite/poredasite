import { useRef, useState, useEffect, useCallback } from "react";
import Hls from "hls.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

// Bu fonksiyon m3u8 veya ts dosyasını senin backend'in üzerinden çekecek şekilde URL'i dönüştürür.
function buildProxyUrl(src, videoId) {
  if (!src) return src;
  
  // Zaten API üzerinden geliyorsa dokunma
  if (src.includes("/api/stream/")) return src;

  // R2 public URL'ini senin API proxy'ne çevir
  const match = src.match(/\/videos\/([^/]+)\/(.+)$/);
  if (match) {
    const vId = match[1];
    const filename = match[2];
    return `${API_BASE}/api/stream/${vId}/${filename}`;
  }
  
  // Eğer sadece videoId verilmişse m3u8 proxy dön
  if (videoId && src.includes(".m3u8")) {
     return `${API_BASE}/api/stream/${videoId}/index.m3u8`;
  }

  return src;
}

export default function VideoPlayer({ src, poster, title, videoId, mp4FallbackUrl, onWatchProgress }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hlsReady, setHlsReady] = useState(false);
  const [hlsError, setHlsError] = useState(false);
  const pendingPlay = useRef(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedToast, setShowSpeedToast] = useState(false);
  const [seekAnim, setSeekAnim] = useState(null); // { side, seconds }
  const hideTimer = useRef(null);
  const touchTapTimer = useRef(null);
  const touchTapCount = useRef(0);
  const clickTimer = useRef(null);
  const speedToastTimer = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);
  const hlsInstanceRef    = useRef(null);
  const watchedSecondsRef = useRef(0);
  const playStartRef      = useRef(null);
  // Stall detection: if buffering >8s with no canplay event, the MSE decoder silently
  // rejected the codec (common with non-standard H.264 profiles). Try MP4 fallback.
  const stallTimer = useRef(null);

  // HLS.js setup for m3u8 streams
  useEffect(() => {
    const video = videoRef.current;
    setHlsReady(false);
    setHlsError(false);
    pendingPlay.current    = false;
    watchedSecondsRef.current = 0;
    playStartRef.current      = null;
    
    if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
    }

    if (!video || !src) return;

    if (!src.includes(".m3u8")) {
      video.src = src;
      setHlsReady(true);
      return;
    }

    // iOS Safari: native HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setHlsReady(true);
      return;
    }

    if (!Hls.isSupported()) {
      setHlsError(true);
      return;
    }

    const initHls = (useProxy = false) => {
        if (hlsInstanceRef.current) {
            hlsInstanceRef.current.destroy();
        }

        const hlsConfig = {
          enableWorker: false,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Retry failed segment/manifest loads — transient R2 CDN errors should self-heal
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 4,
          startLevel: -1,
        };

        const hls = new Hls(hlsConfig);
        hlsInstanceRef.current = hls;

        const currentSrc = useProxy ? buildProxyUrl(src, videoId) : src;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setHlsReady(true);
          if (pendingPlay.current) {
            pendingPlay.current = false;
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!useProxy) {
              console.warn("Direct HLS failed, trying proxy...", data.details);
              initHls(true);
            } else if (mp4FallbackUrl) {
              // HLS fully failed — fall back to progressive MP4
              console.warn("HLS proxy failed, falling back to MP4...");
              hls.destroy();
              hlsInstanceRef.current = null;
              const v = videoRef.current;
              if (v) {
                v.src = mp4FallbackUrl;
                v.load();
                setHlsReady(true);
                setBuffering(false);
              } else {
                setHlsError(true);
              }
            } else {
              console.error("HLS proxy also failed, no MP4 fallback available");
              hls.destroy();
              setBuffering(false);
              setPlaying(false);
              setHlsError(true);
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            setBuffering(false);
            setPlaying(false);
            setHlsError(true);
          }
        });

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(currentSrc);
        });
    };

    // İlk deneme direkt CDN (R2) üzerinden
    initHls(false);

    return () => {
      clearTimeout(stallTimer.current);
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [src, videoId]);

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
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": seek(5); break;
        case "ArrowLeft": seek(-5); break;
        case "m": toggleMute(); break;
        case "f": toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function seek(seconds) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    const side = seconds > 0 ? "right" : "left";
    setSeekAnim({ side, seconds });
    setTimeout(() => setSeekAnim(null), 700);
    resetHideTimer();
  }

  async function togglePlay() {
    const v = videoRef.current;
    if (!v) return;

    if (!hlsReady) {
      pendingPlay.current = true;
      setBuffering(true);
      return;
    }

    try {
      if (v.paused) {
        await v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
    } catch (err) {
      if (err.name === "NotSupportedError") {
        setHlsError(true);
      } else if (err.name !== "AbortError") {
        console.error("Playback error:", err);
        setHlsError(true);
      }
    }
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
    const vid = videoRef.current;
    if (!el) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (vid?.webkitEnterFullscreen) vid.webkitEnterFullscreen(); // iOS Safari
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  // Sync fullscreen state with browser events (handles hardware back button etc.)
  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  function setVideoSpeed(s) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
  }

  // Mouse click: single = play/pause (delayed), double = ±20s
  function handleVideoClick(e) {
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      togglePlay();
    }, 220);
  }

  function handleVideoDoubleClick(e) {
    clearTimeout(clickTimer.current);
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seconds = x < rect.width / 2 ? -10 : 10;
    seek(seconds);
  }

  // Touch: single tap = show controls / play/pause, double tap = ±10s seek
  function handleTouchStart(e) {
    const container = containerRef.current;
    if (!container) return;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;

    touchStartPos.current = { x: touch.clientX, y: touch.clientY, side: x < rect.width / 2 ? "left" : "right" };

    // Start long-press for 2x speed
    longPressTimer.current = setTimeout(() => {
      setVideoSpeed(2);
      setShowSpeedToast(true);
    }, 500);
  }

  function handleTouchEnd(e) {
    clearTimeout(longPressTimer.current);

    if (speed === 2) {
      setVideoSpeed(1);
      setShowSpeedToast(false);
      touchStartPos.current = null;
      touchTapCount.current = 0;
      clearTimeout(touchTapTimer.current);
      return;
    }

    // Cancel if finger moved (scroll/drag — not a tap)
    if (touchStartPos.current && e.changedTouches?.[0]) {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        touchStartPos.current = null;
        touchTapCount.current = 0;
        clearTimeout(touchTapTimer.current);
        return;
      }
    }

    const side = touchStartPos.current?.side || "right";
    touchStartPos.current = null;
    touchTapCount.current += 1;
    clearTimeout(touchTapTimer.current);

    if (touchTapCount.current >= 2) {
      // Double tap: seek ±10s
      touchTapCount.current = 0;
      seek(side === "right" ? 10 : -10);
    } else {
      // Wait for possible second tap
      touchTapTimer.current = setTimeout(() => {
        touchTapCount.current = 0;
        // Single tap: toggle play or show controls
        if (showControls) togglePlay();
        else { setShowControls(true); resetHideTimer(); }
      }, 250);
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { clearTimeout(longPressTimer.current); clearTimeout(touchTapTimer.current); touchTapCount.current = 0; touchStartPos.current = null; if (speed === 2) { setVideoSpeed(1); setShowSpeedToast(false); } }}
    >
      <video
        key={src}
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain"
        preload="metadata"
        onTimeUpdate={() => setCurrent(videoRef.current?.currentTime || 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => {
          setBuffering(true);
          // Silent MSE failure detection: if buffering persists >8s while HLS is active,
          // the browser decoded the manifest but silently refused the codec/profile.
          // This is the most common "plays on mobile, black screen on web" cause.
          if (mp4FallbackUrl && hlsInstanceRef.current) {
            clearTimeout(stallTimer.current);
            stallTimer.current = setTimeout(() => {
              const v = videoRef.current;
              const hls = hlsInstanceRef.current;
              if (!v || !hls) return;
              console.warn("[VideoPlayer] HLS stall detected (8s) — switching to MP4 fallback");
              hls.destroy();
              hlsInstanceRef.current = null;
              v.src = mp4FallbackUrl;
              v.load();
              setHlsReady(true);
              setBuffering(false);
            }, 8000);
          }
        }}
        onCanPlay={() => { setBuffering(false); clearTimeout(stallTimer.current); }}
        onPlaying={() => {
          setPlaying(true); setBuffering(false); clearTimeout(stallTimer.current);
          playStartRef.current = Date.now();
        }}
        onPause={() => {
          setPlaying(false);
          if (playStartRef.current) {
            watchedSecondsRef.current += (Date.now() - playStartRef.current) / 1000;
            playStartRef.current = null;
          }
          onWatchProgress?.({
            watchedSeconds: Math.floor(watchedSecondsRef.current),
            duration: videoRef.current?.duration || 0,
          });
        }}
        onEnded={() => {
          setPlaying(false); setShowControls(true);
          if (playStartRef.current) {
            watchedSecondsRef.current += (Date.now() - playStartRef.current) / 1000;
            playStartRef.current = null;
          }
          onWatchProgress?.({
            watchedSeconds: Math.floor(watchedSecondsRef.current),
            duration: videoRef.current?.duration || 0,
          });
        }}
        onError={() => { setBuffering(false); setPlaying(false); setHlsError(true); }}
        onClick={handleVideoClick}
        onDoubleClick={handleVideoDoubleClick}
        aria-label={title}
        playsInline
      />

      {/* HLS error */}
      {hlsError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 pointer-events-none">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-white/80 text-sm">Video yüklenemedi</p>
        </div>
      )}

      {/* Buffering / HLS loading */}
      {(buffering || (!hlsReady && !hlsError && src)) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Big play button */}
      {!playing && !buffering && hlsReady && !hlsError && (
        <button onClick={togglePlay} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
          className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-brand-500/90 hover:bg-brand-400 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-[0_0_40px_rgba(255,107,0,0.4)] pointer-events-auto">
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

      {/* Seek animation overlay */}
      {seekAnim && (
        <div className={`absolute inset-y-0 ${seekAnim.side === "right" ? "right-0" : "left-0"} w-2/5 flex items-center justify-center pointer-events-none`}>
          <div className="bg-white/15 rounded-full w-24 h-24 flex flex-col items-center justify-center gap-1">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              {seekAnim.side === "right"
                ? <path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/>
                : <path d="M6 13c0 3.31 2.69 6 6 6s6-2.69 6-6-2.69-6-6-6v4L7 6l5-5v4c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8H6z"/>
              }
            </svg>
            <span className="text-white text-sm font-bold">
              {seekAnim.seconds > 0 ? `+${seekAnim.seconds}s` : `${seekAnim.seconds}s`}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
        <div className="relative px-3 sm:px-4 pb-3 pt-8">
          {/* Progress */}
          <div className="relative mb-3">
            <input type="range" min={0} max={duration || 100} step={0.1} value={currentTime}
              onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
              className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500
                         hover:h-1.5 transition-all"
              style={{ background: `linear-gradient(to right, #ff6b00 ${progress}%, rgba(255,255,255,0.2) ${progress}%)` }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Skip back 10s */}
            <button onClick={() => seek(-10)} title="-10 saniye (←)"
              className="text-white hover:text-brand-400 transition-colors p-1.5 touch-manipulation">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                <text x="8.5" y="15" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold" fill="currentColor">10</text>
              </svg>
            </button>

            {/* Play/Pause */}
            <button onClick={togglePlay} title="Oynat/Durdur (K)"
              className="text-white hover:text-brand-400 transition-colors p-1.5 touch-manipulation">
              {playing
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>

            {/* Skip forward 10s */}
            <button onClick={() => seek(10)} title="+10 saniye (→)"
              className="text-white hover:text-brand-400 transition-colors p-1.5 touch-manipulation">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                <text x="8.5" y="15" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold" fill="currentColor">10</text>
              </svg>
            </button>

            {/* Mute */}
            <button onClick={toggleMute} title="Ses Aç/Kapat (M)"
              className="text-white hover:text-brand-400 transition-colors p-1.5 touch-manipulation">
              {muted
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              }
            </button>

            <span className="text-white/70 text-xs font-mono ml-1 hidden sm:block">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="text-white/70 text-xs font-mono ml-1 sm:hidden">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1" />

            {/* Speed selector */}
            <div className="hidden sm:flex items-center gap-1">
              {[0.5, 1, 1.5, 2].map(s => (
                <button key={s} onClick={() => setVideoSpeed(s)}
                  className={`text-xs font-mono px-1.5 py-0.5 rounded transition-all touch-manipulation
                    ${speed === s ? "bg-brand-500 text-white" : "text-white/60 hover:text-white"}`}>
                  {s}x
                </button>
              ))}
            </div>

            <button onClick={toggleFullscreen} title="Tam Ekran (F)"
              className="text-white hover:text-brand-400 transition-colors p-1.5 touch-manipulation">
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
