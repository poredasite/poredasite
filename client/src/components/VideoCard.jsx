import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Hls from "hls.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

// (pointer: coarse) = parmak/dokunmatik ekran — çok daha güvenilir detection.
// (hover: hover) Android'da bazı cihazlarda yanlış true döndürüyor, kullanma.
const IS_TOUCH =
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0);

// --- Global singleton: aynı anda yalnızca bir kart preview oynatır ---
let activePreviewId = null;
const setActivePreview = (id) => {
  if (activePreviewId !== id) {
    activePreviewId = id;
    document.dispatchEvent(new CustomEvent("activepreviewchange", { detail: { id } }));
  }
};
// --------------------------------------------------------------------

function getProxyUrl(url, videoId) {
  if (!url?.includes(".m3u8")) return url;
  if (videoId) return `${API_BASE}/api/stream/${videoId}/index.m3u8`;
  const match = url.match(/\/videos\/([^/]+)\/index\.m3u8/);
  return match ? `${API_BASE}/api/stream/${match[1]}/index.m3u8` : url;
}

function formatViews(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getCategories(video) {
  if (video.categories?.length > 0) return video.categories.filter(Boolean);
  if (video.category) return [video.category];
  return [];
}

function logPlayError(id, err, label = "") {
  const reason =
    err?.name === "NotAllowedError"   ? "autoplay-blocked"        :
    err?.name === "AbortError"        ? "aborted"                 :
    err?.name === "NotSupportedError" ? "codec-not-supported"     :
    err?.name === "NetworkError"      ? "network-error"           :
    `unknown(${err?.name})`;
  console.warn(`[Preview ${id}]${label} play() → ${reason}: ${err?.message}`);
}

export default function VideoCard({ video, priority = false }) {
  const navigate = useNavigate();
  const [imgLoaded,     setImgLoaded]     = useState(false);
  const [imgError,      setImgError]      = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError,  setPreviewError]  = useState(false);
  const [isActivePreview, setIsActivePreview] = useState(false);

  const videoRef        = useRef(null);
  const hlsRef          = useRef(null);
  const hlsReadyRef     = useRef(false);
  const isActiveRef     = useRef(false);   // sync ref: effect callbacks read this
  const hadMouseEnter   = useRef(false);   // true while a real mouse is over this card
  const hoverTimer      = useRef(null);

  const { ref, inView } = useInView({ threshold: 0.7 });
  const { ref: imgRef, inView: imgInView } = useInView({ triggerOnce: true, rootMargin: "300px" });

  const shouldLoadImg = priority || imgInView;
  const cats          = getCategories(video);

  const previewUrl = video.previewVideoUrl || null;
  const hasPreview = !!previewUrl && !previewError;
  const isMp4      = previewUrl?.includes(".mp4");
  const isHLS      = previewUrl?.includes(".m3u8");

  useEffect(() => { isActiveRef.current = isActivePreview; }, [isActivePreview]);

  // ── HLS setup (lazy) ────────────────────────────────────────────────────
  const ensureHlsReady = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !isHLS || hlsRef.current) return;

    if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      // iOS Safari: native HLS
      if (!vid.src) vid.src = previewUrl;
      hlsReadyRef.current = true;
      return;
    }
    if (!Hls.isSupported()) { setPreviewError(true); return; }

    const hls = new Hls({ enableWorker: false, startLevel: 0, maxBufferLength: 10 });
    hlsRef.current = hls;
    hls.loadSource(getProxyUrl(previewUrl, video._id));
    hls.attachMedia(vid);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hlsReadyRef.current = true;
      if (isActiveRef.current) {
        vid.play().catch((e) => { logPlayError(video._id, e, " [HLS manifest]"); setPreviewError(true); });
      }
    });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) { console.error(`[Preview ${video._id}] HLS fatal: ${d.type}/${d.details}`); setPreviewError(true); }
    });
  }, [isHLS, previewUrl, video._id]);

  // ── Pre-warm: src + metadata yükle, kart görünür olunca ─────────────────
  // Böylece kullanıcı tap ettiğinde readyState >= 1, play() anında başlar.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !previewUrl || !inView) return;
    if (isMp4 && !vid.src) vid.src = previewUrl;
    else if (isHLS)         ensureHlsReady();
  }, [inView, previewUrl, isMp4, isHLS, ensureHlsReady]);

  // ── Temel play fonksiyonu ─────────────────────────────────────────────────
  // MUTLAKA bir user gesture handler içinden (touchstart, click) çağırılmalı.
  const tryPlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !previewUrl || previewError) return;

    if (isMp4) {
      if (!vid.src) { vid.src = previewUrl; vid.load(); }
      const p = vid.play();
      if (!p) return;
      p.catch(async (err) => {
        logPlayError(video._id, err);
        if (err.name === "AbortError") return;
        // Bir kez retry yap
        await new Promise((r) => setTimeout(r, 300));
        const v2 = videoRef.current;
        if (!v2 || !isActiveRef.current) return;
        v2.play().catch((e2) => { logPlayError(video._id, e2, " [retry]"); setPreviewError(true); });
      });
    } else if (isHLS) {
      if (hlsReadyRef.current) {
        const p = videoRef.current?.play();
        if (p) p.catch((e) => { logPlayError(video._id, e); setPreviewError(true); });
      } else {
        ensureHlsReady(); // MANIFEST_PARSED handler devralır
      }
    }
  }, [previewUrl, previewError, isMp4, isHLS, ensureHlsReady, video._id]);

  const stopPreview = useCallback(() => {
    const vid = videoRef.current;
    if (vid && !vid.paused) vid.pause();
  }, []);

  // Görünümden çıkınca durdur
  useEffect(() => {
    if (!inView && isActiveRef.current) setActivePreview(null);
  }, [inView]);

  // Global active-preview event sync
  useEffect(() => {
    const handler = (e) => setIsActivePreview(e.detail.id === video._id);
    setIsActivePreview(activePreviewId === video._id);
    document.addEventListener("activepreviewchange", handler);
    return () => document.removeEventListener("activepreviewchange", handler);
  }, [video._id]);

  // Effect: sadece MASAÜSTÜ hover akışı için play() çağırır.
  // Mobilde play() gesture handler içinden (touchstart/click) çağrılır,
  // effect'ten çağrılmaz — bu kural kırılırsa iOS NotAllowedError verir.
  useEffect(() => {
    if (isActivePreview) {
      if (hadMouseEnter.current) tryPlay(); // masaüstü hover
      // mobil: play() zaten touchstart veya onClick içinde çağrıldı
    } else {
      stopPreview();
    }
  }, [isActivePreview, tryPlay, stopPreview]);

  // Cleanup
  useEffect(() => () => {
    clearTimeout(hoverTimer.current);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, []);

  // ── Masaüstü: hover intent ───────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    hadMouseEnter.current = true;
    if (!hasPreview) return;
    hoverTimer.current = setTimeout(() => setActivePreview(video._id), 150);
  }, [video._id, hasPreview]);

  const handleMouseLeave = useCallback(() => {
    hadMouseEnter.current = false;
    clearTimeout(hoverTimer.current);
    setActivePreview(null);
  }, []);

  // ── Mobil: touchstart — Android Chrome bu event'i user gesture sayar ────
  // play() burada çağrılırsa Android'de hemen başlar.
  // iOS bunu user gesture saymaz, NotAllowedError verir (sessizce yutulur);
  // iOS'ta gerçek play() aşağıdaki onClick içinde tetiklenir.
  const handleTouchStart = useCallback(() => {
    if (!hasPreview || activePreviewId === video._id) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (isMp4 && !vid.src) { vid.src = previewUrl; vid.load(); }
    // Sessizce dene — iOS'ta zaten fail eder, onClick devralır
    vid.play().catch(() => {});
  }, [hasPreview, video._id, previewUrl, isMp4]);

  // ── onClick: iOS için kesin user gesture kaynağı (touchend → click) ─────
  // hadMouseEnter ref'i ile gerçek mouse click vs touch click ayırt edilir.
  const handleCardClick = useCallback(() => {
    // Gerçek mouse hover sonrası click = masaüstü → direkt navigate et
    if (hadMouseEnter.current) {
      navigate(`/video/${video._id}`);
      return;
    }

    // Mobil yol
    if (!hasPreview) {
      navigate(`/video/${video._id}`);
      return;
    }

    if (activePreviewId === video._id) {
      // İkinci tap veya zaten oynuyor → navigate et
      navigate(`/video/${video._id}`);
      setActivePreview(null);
      return;
    }

    // İlk tap: preview başlat — play() bu click gesture içinde çağrılıyor ✓
    setActivePreview(video._id);
    tryPlay();
  }, [hasPreview, video._id, navigate, tryPlay]);

  const handleTitleClick = useCallback((e) => {
    e.stopPropagation();
    navigate(`/video/${video._id}`);
  }, [video._id, navigate]);

  return (
    <div
      className="group flex flex-col gap-2 focus-visible:ring-brand-500 rounded-xl touch-manipulation"
      aria-label={`İzle: ${video.title}`}
      onTouchStart={handleTouchStart}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail kapsayıcı */}
      <div ref={ref} className="relative rounded-xl overflow-hidden bg-surface-800" style={{ aspectRatio: "16/9" }}>

        <div ref={imgRef} className="absolute inset-0 w-full h-full pointer-events-none">
          {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton" />}

          {shouldLoadImg && !imgError && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              } ${previewPlaying ? "opacity-0" : ""}`}
            />
          )}
        </div>

        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Preview video
            muted + playsInline + webkit-playsinline → iOS autoplay şartı
            preload="metadata"  → src set edilince ilk kare + süre yüklenir
            src başlangıçta yok; kart görünüme girince pre-warm effect set eder */}
        {hasPreview && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="metadata"
            webkit-playsinline="true"
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onError={() => { console.error(`[Preview ${video._id}] video element error`); setPreviewError(true); }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${
              previewPlaying ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded-md font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-300 ${
            previewPlaying ? "opacity-0 scale-75" : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
          }`}>
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      </div>

      {/* Bilgi */}
      <div className="px-0.5">
        <h3
          onClick={handleTitleClick}
          className="text-white text-sm font-display font-semibold leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors duration-200 mb-1 cursor-pointer"
        >
          {video.title}
        </h3>
        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
          <span className="font-medium">{formatViews(video.views)} izlenme</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: tr })}</span>
        </div>
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cats.slice(0, 2).map((cat) => (
              <span key={cat._id} className="text-[10px] text-brand-500/70 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded-full">
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
