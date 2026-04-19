import { Link } from "react-router-dom";
import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useVideoPreview } from "../hooks/useVideoPreview";

function formatViews(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

export default function VideoCard({ video, priority = false }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  const { ref: imgRef, inView: imgInView } = useInView({ triggerOnce: true, rootMargin: "300px" });

  const previewUrl = video.previewVideoUrl || null;
  const { containerProps, videoProps, isPlaying } = useVideoPreview(
    video._id,
    previewUrl,
    null,   // navigation handled by the Link component below
  );

  const shouldLoad = priority || imgInView;
  const dur        = formatDuration(video.duration);

  return (
    <div {...containerProps} className="group flex flex-col gap-2">

      {/* ── Thumbnail ──────────────────────────────────────────────── */}
      <Link to={`/video/${video._id}`} className="block relative rounded-xl overflow-hidden bg-neutral-900"
        style={{ aspectRatio: "16/9" }}>

        <div ref={imgRef} className="absolute inset-0">
          {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton" />}

          {shouldLoad && !imgError && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
                imgLoaded && !isPlaying ? "opacity-100 group-hover:scale-[1.03]" : "opacity-0"
              }`}
            />
          )}
        </div>

        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {previewUrl && (
          <video
            {...videoProps}
            // eslint-disable-next-line react/no-unknown-property
            webkit-playsinline="true"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${
              isPlaying ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {dur && (
          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] font-mono px-1.5 py-0.5 rounded-md">
            {dur}
          </span>
        )}

        {/* Hover play icon */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          isPlaying ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}>
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </Link>

      {/* ── Info ───────────────────────────────────────────────────── */}
      <div className="px-0.5">
        <Link to={`/video/${video._id}`}>
          <h3 className="text-white text-sm font-medium leading-snug line-clamp-2 hover:text-neutral-300 transition-colors">
            {video.title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 flex-wrap text-neutral-600 text-xs mt-1">
          <span>{formatViews(video.views)} izlenme</span>
          {video.likes > 0 && (
            <span className="flex items-center gap-0.5 text-neutral-700">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              {formatViews(video.likes)}
            </span>
          )}
          <span className="text-neutral-700">&middot; {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: tr })}</span>
        </div>
      </div>
    </div>
  );
}
