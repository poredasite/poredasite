import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Hls from "hls.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

// --- Global state for active preview ---
let activePreviewId = null;
let setActivePreview = (id) => {
  activePreviewId = id;
  document.dispatchEvent(new CustomEvent('activepreviewchange', { detail: { id } }));
};
// -------------------------------------

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

export default function VideoCard({ video, priority = false }) {
  const navigate = useNavigate();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isActivePreview, setIsActivePreview] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const cardRef = useRef(null);

  // 70% visibility threshold for autoplay
  const { ref, inView } = useInView({ threshold: 0.7 });
  // We use a larger rootMargin to load images before they come into view
  const { ref: imgRef, inView: imgInView } = useInView({ triggerOnce: true, rootMargin: "300px" });
  
  const shouldLoadImg = priority || imgInView;
  const cats = getCategories(video);

  const previewUrl = video.previewVideoUrl || video.videoUrl || null;
  const hasPreview = !!previewUrl && !previewError;
  const isMp4 = previewUrl?.includes(".mp4");

  const startPreview = useCallback(() => {
    if (previewPlaying) return;
    const vid = videoRef.current;
    if (!vid || !previewUrl || previewError) return;

    // Restart from 0 seconds
    vid.currentTime = 0;

    const isHLS = previewUrl.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      if (!hlsRef.current) {
          const proxySrc = getProxyUrl(previewUrl, video._id);
          const hls = new Hls({ enableWorker: false, startLevel: 0, maxBufferLength: 10 });
          hlsRef.current = hls;
          hls.loadSource(proxySrc);
          hls.attachMedia(vid);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            vid.play().catch(() => setPreviewError(true));
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) setPreviewError(true);
          });
      } else {
         vid.play().catch(() => setPreviewError(true));
      }
    } else if (isHLS && vid.canPlayType("application/vnd.apple.mpegurl")) {
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    } else if (isMp4) {
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    }
  }, [previewUrl, previewError, video._id, isMp4, previewPlaying]);

  const stopPreview = useCallback(() => {
    if (!previewPlaying) return;
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
    }
    setPreviewPlaying(false);
  }, [previewPlaying]);

  // Handle intersection observer trigger
  useEffect(() => {
    if (inView) {
      setActivePreview(video._id);
    } else if (activePreviewId === video._id) {
      // If we scroll out of view and we were the active preview, clear it
      setActivePreview(null);
    }
  }, [inView, video._id]);

  // Listen for global active preview changes
  useEffect(() => {
    const handler = (e) => {
      setIsActivePreview(e.detail.id === video._id);
    };
    
    // Set initial state in case this mounts while already active
    setIsActivePreview(activePreviewId === video._id);
    
    document.addEventListener('activepreviewchange', handler);
    return () => document.removeEventListener('activepreviewchange', handler);
  }, [video._id]);

  // Play/Pause based on active state
  useEffect(() => {
    if (isActivePreview) {
      startPreview();
    } else {
      stopPreview();
    }
  }, [isActivePreview, startPreview, stopPreview]);

  // Touch and Hover interactions to explicitly activate
  const handleInteraction = useCallback(() => {
    setActivePreview(video._id);
  }, [video._id]);

  const handleClick = useCallback(() => {
    navigate(`/video/${video._id}`);
  }, [navigate, video._id]);

  useEffect(() => () => {
    if (hlsRef.current) { hlsRef.current.destroy(); }
  }, []);

  return (
    <div
      ref={cardRef}
      className="group flex flex-col gap-2 focus-visible:ring-brand-500 rounded-xl touch-manipulation cursor-pointer"
      aria-label={`İzle: ${video.title}`}
      onClick={handleClick}
      onMouseEnter={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Thumbnail container */}
      <div ref={ref} className="relative rounded-xl overflow-hidden bg-surface-800" style={{ aspectRatio: "16/9" }}>

        <div ref={imgRef} className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Skeleton */}
          {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton" />}

          {/* Thumbnail image */}
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

        {/* Error fallback */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Preview video */}
        {hasPreview && (
          <video
            ref={videoRef}
            muted
            playsInline
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onError={() => setPreviewError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              previewPlaying ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded-md font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Play icon on hover/long-press */}
        <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none flex items-center justify-center`}>
          <div className={`w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-300 ${
            previewPlaying ? "opacity-0 scale-75" : "opacity-0 group-hover:opacity-100 group-active:opacity-100 scale-75 group-hover:scale-100 group-active:scale-100"
          }`}>
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-0.5">
        <h3 className="text-white text-sm font-display font-semibold leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors duration-200 mb-1">
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
              <span key={cat._id}
                className="text-[10px] text-brand-500/70 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded-full">
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
