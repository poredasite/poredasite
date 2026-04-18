import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useVideoPreview } from '../hooks/useVideoPreview';

function formatViews(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getCategories(video) {
  if (video.categories?.length > 0) return video.categories.filter(Boolean);
  if (video.category) return [video.category];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoCard — reusable card for homepage grid, related videos, search, etc.
// All preview logic lives in useVideoPreview / previewManager.
// ─────────────────────────────────────────────────────────────────────────────
export default function VideoCard({ video, priority = false }) {
  const navigate = useNavigate();

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  // Lazy-load thumbnail only when near viewport
  const { ref: imgRef, inView: imgInView } = useInView({
    triggerOnce: true,
    rootMargin: '300px',
  });

  const previewUrl = video.previewVideoUrl || null;

  const { containerProps, videoProps, isPlaying, onCardClick } = useVideoPreview(
    video._id,
    previewUrl,
    () => navigate(`/video/${video._id}`),
  );

  const shouldLoadImg = priority || imgInView;
  const cats = getCategories(video);

  const handleTitleClick = useCallback((e) => {
    e.stopPropagation();
    navigate(`/video/${video._id}`);
  }, [navigate, video._id]);

  return (
    <div
      {...containerProps}
      onClick={onCardClick}
      className="group flex flex-col gap-2 rounded-xl touch-manipulation focus-visible:ring-brand-500"
      aria-label={`İzle: ${video.title}`}
    >
      {/* ── Thumbnail container ─────────────────────────────────────── */}
      <div
        className="relative rounded-xl overflow-hidden bg-surface-800"
        style={{ aspectRatio: '16/9' }}
      >
        {/* Thumbnail image (lazy) */}
        <div ref={imgRef} className="absolute inset-0 pointer-events-none">
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 skeleton" />
          )}
          {shouldLoadImg && !imgError && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                imgLoaded && !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
        </div>

        {/* Fallback icon if thumbnail fails */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Preview video — src is set only when preview starts */}
        {previewUrl && (
          <video
            {...videoProps}
            // eslint-disable-next-line react/no-unknown-property
            webkit-playsinline="true"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${
              isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded-md font-medium">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-300 ${
            isPlaying
              ? 'opacity-0 scale-75'
              : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
          }`}>
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Card info ───────────────────────────────────────────────── */}
      <div className="px-0.5">
        <h3
          onClick={handleTitleClick}
          className="text-white text-base font-display font-semibold leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors duration-200 mb-1 cursor-pointer"
        >
          {video.title}
        </h3>

        <div className="flex items-center gap-1.5 text-gray-500 text-sm">
          <span className="font-medium">{formatViews(video.views)} izlenme</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: tr })}</span>
        </div>

        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cats.slice(0, 2).map((cat) => (
              <span
                key={cat._id}
                className="text-[10px] text-brand-500/70 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded-full"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
