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
    null,
  );

  const shouldLoad = priority || imgInView;
  const dur        = formatDuration(video.duration);

  return (
    <div {...containerProps} className="group flex flex-col gap-2">

      {/* ── Thumbnail ──────────────────────────────────────────────── */}
      <Link
        to={`/video/${video.slug || video._id}`}
        className="block relative rounded-xl overflow-hidden bg-neutral-900"
        style={{ aspectRatio: "16/9" }}
      >
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
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
                imgLoaded && !isPlaying ? "opacity-100 group-hover:scale-[1.03]" : "opacity-0"
              }`}
            />
          )}
        </div>

        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
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

        {/* Hover dark overlay — replaces brightness filter to avoid jitter */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />

        {/* Duration badge */}
        {dur && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-mono font-medium px-1.5 py-0.5 rounded tabular-nums">
            {dur}
          </span>
        )}

        {/* Hover play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          isPlaying ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}>
          <div className="w-11 h-11 rounded-full bg-brand-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-brand-500/30">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </Link>

      {/* ── Info ───────────────────────────────────────────────────── */}
      <div className="px-1">
        <Link to={`/video/${video.slug || video._id}`}>
          <h3 className="text-neutral-200 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {video.title}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 mt-1 text-neutral-600 text-[11px]">
          <span className="font-medium text-neutral-500">
            {formatViews(video.displayViews ?? video.views)}
          </span>
          <span>izlenme</span>
          <span className="text-neutral-700">&middot;</span>
          <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: tr })}</span>
        </div>
      </div>
    </div>
  );
}
