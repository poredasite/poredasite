import { Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow, format } from "date-fns";

function formatViews(n) {
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
  const [imgLoaded, setImgLoaded]     = useState(false);
  const [imgError, setImgError]       = useState(false);
  const [isHovered, setIsHovered]     = useState(false);
  const [previewSrc, setPreviewSrc]   = useState(null);   // loaded lazily on first hover
  const [previewError, setPreviewError] = useState(false);

  const videoRef      = useRef(null);
  const hoverTimer    = useRef(null);

  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  const shouldLoad = priority || inView;
  const cats = getCategories(video);

  const hasPreview = !!video.previewVideoUrl && !previewError;
  const showPreview = isHovered && hasPreview && !!previewSrc;

  // ── Hover handlers ─────────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      setIsHovered(true);
      // Set src on first hover (lazy load)
      if (video.previewVideoUrl && !previewError) {
        setPreviewSrc(video.previewVideoUrl);
      }
    }, 280);
  }, [video.previewVideoUrl, previewError]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Play / pause when hover state changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !previewSrc) return;
    if (isHovered) {
      vid.play().catch(() => setPreviewError(true));
    } else {
      vid.pause();
    }
  }, [isHovered, previewSrc]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <Link
      to={`/video/${video._id}`}
      className="group flex flex-col gap-2.5 focus-visible:ring-brand-500 rounded-xl p-1.5 hover:bg-surface-800/40 transition-all duration-200 -m-1.5"
      aria-label={`İzle: ${video.title}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Thumbnail container ────────────────────────────────────────────── */}
      <div ref={ref} className="video-thumbnail rounded-xl overflow-hidden relative">

        {/* Skeleton */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 skeleton" />
        )}

        {/* Thumbnail image */}
        {shouldLoad && !imgError && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500
              ${imgLoaded ? "opacity-100" : "opacity-0"}
              ${showPreview ? "opacity-0" : ""}`}
          />
        )}

        {/* Error fallback */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
            <svg className="w-10 h-10 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* ── Hover preview video ──────────────────────────────────────────── */}
        {hasPreview && (
          <video
            ref={videoRef}
            src={previewSrc || undefined}
            muted
            loop
            playsInline
            preload="none"
            onError={() => setPreviewError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
              ${showPreview ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 z-10 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className={`w-11 h-11 bg-brand-500/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg
            transition-all duration-300
            ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"}`}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Live preview badge */}
        {showPreview && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-fade-in">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            ÖNIZLEME
          </div>
        )}
      </div>

      {/* ── Info ───────────────────────────────────────────────────────────── */}
      <div className="px-0.5">
        <h3 className="text-white text-sm font-display font-semibold leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors duration-200 mb-1.5">
          {video.title}
        </h3>
        <div className="flex items-center gap-1.5 text-gray-600 text-xs mb-1">
          <span>{formatViews(video.views)} izlenme</span>
          <span>·</span>
          <span title={format(new Date(video.createdAt), "MMM d, yyyy")}>
            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </span>
        </div>
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 2).map((cat) => (
              <span key={cat._id} className="text-[10px] text-brand-500/70 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded">
                {cat.name}
              </span>
            ))}
            {cats.length > 2 && (
              <span className="text-[10px] text-gray-600">+{cats.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
