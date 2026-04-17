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

function getCategories(video) {
  if (video.categories?.length > 0) return video.categories.filter(Boolean);
  if (video.category) return [video.category];
  return [];
}

export default function VideoCard({ video, priority = false }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  const shouldLoad = priority || inView;
  const cats = getCategories(video);

  return (
    <Link
      to={`/video/${video._id}`}
      className="group flex flex-col gap-2.5 focus-visible:ring-brand-500 rounded-xl p-1.5 hover:bg-surface-800/40 transition-all duration-200 -m-1.5"
      aria-label={`Watch: ${video.title}`}
    >
      {/* Thumbnail */}
      <div ref={ref} className="video-thumbnail group rounded-lg overflow-hidden">
        {(!imgLoaded || !shouldLoad) && !imgError && (
          <div className="absolute inset-0 skeleton" />
        )}
        {shouldLoad && !imgError && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
            <svg className="w-10 h-10 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded font-medium">
            {formatDuration(video.duration)}
          </span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="w-11 h-11 bg-brand-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
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
            {cats.slice(0, 2).map(cat => (
              <span key={cat._id} className="text-[10px] text-brand-500/70 font-medium bg-brand-500/8 px-1.5 py-0.5 rounded">
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
