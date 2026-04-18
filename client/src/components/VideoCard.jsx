import { Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Hls from "hls.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hoverTimer = useRef(null);

  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "300px" });
  const shouldLoad = priority || inView;
  const cats = getCategories(video);

  const previewUrl = video.previewVideoUrl || video.videoUrl || null;
  const hasPreview = !!previewUrl && !previewError;

  const startPreview = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !previewUrl || previewError) return;

    const isHLS = previewUrl.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      // Use proxy URL to avoid CORS issues with HLS segments
      const proxySrc = getProxyUrl(previewUrl, video._id);
      const hls = new Hls({ enableWorker: false, startLevel: 0, maxBufferLength: 15 });
      hlsRef.current = hls;
      hls.loadSource(proxySrc);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        vid.play().catch(() => setPreviewError(true));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setPreviewError(true);
      });
    } else if (isHLS && vid.canPlayType("application/vnd.apple.mpegurl")) {
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    } else {
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    }
  }, [previewUrl, previewError, video._id]);

  const stopPreview = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
      vid.removeAttribute("src");
      vid.load();
    }
    setPreviewPlaying(false);
  }, []);

  const previewActivated = useRef(false);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => startPreview(), 300);
  }, [startPreview]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    stopPreview();
  }, [stopPreview]);

  // Mobile: long-press to preview, release to stop (short tap still navigates)
  const handleTouchStart = useCallback(() => {
    previewActivated.current = false;
    hoverTimer.current = setTimeout(() => {
      previewActivated.current = true;
      startPreview();
    }, 600);
  }, [startPreview]);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(hoverTimer.current);
    if (previewActivated.current) {
      e.preventDefault(); // don't navigate on release after preview
      stopPreview();
      previewActivated.current = false;
    }
  }, [stopPreview]);

  useEffect(() => () => {
    clearTimeout(hoverTimer.current);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, []);

  return (
    <Link
      to={`/video/${video._id}`}
      className="group flex flex-col gap-2 focus-visible:ring-brand-500 rounded-xl touch-manipulation"
      aria-label={`İzle: ${video.title}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Thumbnail container */}
      <div ref={ref} className="relative rounded-xl overflow-hidden bg-surface-800" style={{ aspectRatio: "16/9" }}>

        {/* Skeleton */}
        {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton" />}

        {/* Thumbnail image */}
        {shouldLoad && !imgError && (
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
            loop
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
    </Link>
  );
}
