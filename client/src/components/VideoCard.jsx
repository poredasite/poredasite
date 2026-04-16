import { Link } from "react-router-dom";
import { useState } from "react";
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

export default function VideoCard({ video, priority = false }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px",
  });

  const shouldLoad = priority || inView;

  return (
    <Link
      to={`/video/${video._id}`}
      className="group flex flex-col gap-3 focus-visible:ring-brand-500 rounded-2xl p-2 hover:bg-surface-800/50 transition-all duration-300 -m-2"
      aria-label={`Watch: ${video.title}`}
    >
      {/* Thumbnail */}
      <div ref={ref} className="video-thumbnail group rounded-xl overflow-hidden">
        {/* Placeholder while loading */}
        {(!imgLoaded || !shouldLoad) && !imgError && (
          <div className="absolute inset-0 skeleton" />
        )}

        {/* Actual image — lazy loaded */}
        {shouldLoad && !imgError && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-all duration-500
                        group-hover:scale-105
                        ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Fallback for broken images */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
            <svg className="w-12 h-12 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs
                           font-mono px-1.5 py-0.5 rounded font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100
                        transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 bg-brand-500/90 rounded-full flex items-center justify-center
                          scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-3 px-0.5">
        {/* Channel avatar placeholder */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                        flex items-center justify-center flex-shrink-0 mt-0.5 text-white
                        text-xs font-display font-bold">
          {video.title?.charAt(0)?.toUpperCase() || "V"}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-display font-semibold leading-snug
                         line-clamp-2 group-hover:text-brand-300 transition-colors duration-200">
            {video.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-gray-500 text-xs">
            <span>{formatViews(video.views)} views</span>
            <span className="text-surface-600">·</span>
            <span title={format(new Date(video.createdAt), "MMM d, yyyy")}>
              {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
            </span>
          </div>
          {video.category && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-brand-500/80 font-medium">
              <span>{video.category.icon}</span>
              {video.category.name}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
