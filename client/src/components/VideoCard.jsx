import { Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow, format } from "date-fns";
import Hls from "hls.js";

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

function getPreviewUrl(video) {
  if (video.previewVideoUrl) return video.previewVideoUrl;
  if (video.videoUrl) return video.videoUrl;
  return null;
}

export default function VideoCard({ video, priority = false }) {
  const [imgLoaded, setImgLoaded]       = useState(false);
  const [imgError, setImgError]         = useState(false);
  const [isHovered, setIsHovered]       = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false); // video gerçekten başladıysa
  const [previewError, setPreviewError] = useState(false);

  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const hoverTimer = useRef(null);

  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  const shouldLoad = priority || inView;
  const cats       = getCategories(video);
  const previewUrl = getPreviewUrl(video);
  const hasPreview = !!previewUrl && !previewError;

  const startPreview = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !previewUrl || previewError) return;

    const isHLS = previewUrl.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false, startLevel: 0, maxBufferLength: 10 });
      hlsRef.current = hls;
      hls.loadSource(previewUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        vid.play().catch(() => setPreviewError(true));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setPreviewError(true);
      });
    } else if (isHLS && vid.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    } else {
      // MP4
      vid.src = previewUrl;
      vid.play().catch(() => setPreviewError(true));
    }
  }, [previewUrl, previewError]);

  const stopPreview = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
      vid.src = "";
      vid.load();
    }
    setPreviewPlaying(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      setIsHovered(true);
      startPreview();
    }, 300);
  }, [startPreview]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setIsHovered(false);
    stopPreview();
  }, [stopPreview]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(hoverTimer.current);
    stopPreview();
  }, []);

  return (
    <Link
      to={`/video/${video._id}`}
      className="group flex flex-col gap-2.5 focus-visible:ring-brand-500 rounded-xl p-1.5 hover:bg-surface-800/40 transition-all duration-200 -m-1.5"
      aria-label={`İzle: ${video.title}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={ref} className="video-thumbnail rounded-xl overflow-hidden relative">

        {/* Skeleton */}
        {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton" />}

        {/* Thumbnail */}
        {shouldLoad && !imgError && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500
              ${imgLoaded ? "opacity-100" : "opacity-0"}
              ${previewPlaying ? "opacity-0" : ""}`}
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

        {/* Preview video — her zaman DOM'da, src hover'da set edilir */}
        {hasPreview && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onError={() => setPreviewError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
              ${previewPlaying ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-300 pointer-events-none" />
      </div>

      {/* Info */}
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
