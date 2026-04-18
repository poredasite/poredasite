import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { videoApi } from "../api";
import VideoPlayer from "../components/VideoPlayer";
import VideoCard from "../components/VideoCard";
import { VideoDetailSkeleton } from "../components/Skeletons";
import { TopBannerAd, InstreamVideoAd, BelowDescriptionAd } from "../components/AdPlaceholders";
import { useAds } from "../context/AdsContext";
import SEOHead from "../components/SEOHead";
import { parseLinkedDescription } from "../lib/linkedDescription";

// ── Formatters ────────────────────────────────────────────────────────────────
function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n?.toString() || "0";
}

function formatDuration(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ── LinkedDescription — renders description with injected tag/video/cat links ──
function LinkedDescription({ text, tags, relatedVideos, categories }) {
  const segments = parseLinkedDescription(text, { tags, relatedVideos, categories });
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <Link
            key={i}
            to={`/tag/${encodeURIComponent(seg.tag)}`}
            className="text-brand-400 hover:text-brand-300 underline underline-offset-2 decoration-brand-500/40 transition-colors"
          >
            {seg.content}
          </Link>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}

// ── WatchNextCard — top related video, shown in sidebar ──────────────────────
function WatchNextCard({ video }) {
  const d = formatDuration(video.duration);
  return (
    <div className="mb-1">
      <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Sıradaki</p>
      <Link
        to={`/video/${video._id}`}
        className="block group rounded-xl overflow-hidden bg-surface-800 border border-white/5 hover:border-brand-500/30 transition-all duration-200"
      >
        <div className="relative" style={{ aspectRatio: "16/9" }}>
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {d && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
              {d}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
            {video.title}
          </p>
          <p className="text-gray-600 text-xs mt-1">{formatViews(video.views)} izlenme</p>
        </div>
      </Link>
    </div>
  );
}

// ── RelatedMiniCard — compact list card for desktop sidebar ──────────────────
function RelatedMiniCard({ video }) {
  const d = formatDuration(video.duration);
  return (
    <Link
      to={`/video/${video._id}`}
      className="flex gap-3 group hover:bg-surface-800/60 rounded-xl p-1.5 -mx-1.5 transition-colors"
    >
      <div
        className="relative flex-shrink-0 w-[120px] rounded-lg overflow-hidden bg-surface-800"
        style={{ aspectRatio: "16/9" }}
      >
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {d && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 py-0.5 rounded">
            {d}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-white text-xs font-medium leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {video.title}
        </p>
        <p className="text-gray-600 text-[11px] mt-1">{formatViews(video.views)} izlenme</p>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VideoDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [video,          setVideo]          = useState(null);
  const [related,        setRelated]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [descExpanded,   setDescExpanded]   = useState(false);
  const [showInstream,   setShowInstream]   = useState(true);
  const { getSlot }     = useAds();
  const instreamSlot    = getSlot("instreamVideo");
  const lastWatchRef    = useRef(null);  // { watchedSeconds, duration }

  // ── Watch time: flush via sendBeacon when tab hides ──────────────────────
  useEffect(() => {
    if (!video?._id) return;
    const onHide = () => {
      const d = lastWatchRef.current;
      if (!d || d.watchedSeconds < 5) return;
      const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");
      const blob = new Blob(
        [JSON.stringify({ watchTime: d.watchedSeconds, duration: d.duration })],
        { type: "application/json" }
      );
      navigator.sendBeacon?.(`${apiBase}/videos/${video._id}/watch`, blob);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [video?._id]);

  const handleWatchProgress = useCallback(({ watchedSeconds, duration }) => {
    lastWatchRef.current = { watchedSeconds, duration };
    if (watchedSeconds < 10 || !video?._id) return;
    // Also send immediately on each pause/end so we don't lose data
    videoApi.recordWatch(video._id, { watchTime: watchedSeconds, duration }).catch(() => {});
  }, [video?._id]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDescExpanded(false);
    setShowInstream(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    videoApi
      .getById(id)
      .then((res) => {
        setVideo(res.data);
        setRelated(res.related || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <VideoDetailSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center gap-5 animate-fade-in">
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-white font-display font-bold text-2xl">Video bulunamadı</h1>
        <p className="text-gray-500">{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary">← Ana Sayfaya Dön</button>
      </div>
    );
  }

  if (!video) return null;

  const shortDesc    = video.description?.slice(0, 200);
  const hasLongDesc  = video.description?.length > 200;
  const tags         = video.tags || [];
  const watchNext    = related[0] || null;
  const sidebarList  = related.slice(1, 12);

  return (
    <>
      <SEOHead
        title={video.title}
        description={video.description?.slice(0, 160) || `Watch "${video.title}" on VideoSite`}
        image={video.thumbnailUrl}
        url={`/video/${video._id}`}
        type="video.other"
        videoUrl={video.videoUrl}
      />

      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-4 sm:py-6 animate-fade-in">
        <TopBannerAd />

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* ── LEFT: player + info ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Player */}
            <div className="w-full">
              {video.status !== "ready" || !video.videoUrl ? (
                <div className="w-full aspect-video bg-surface-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                  {video.status === "error" ? (
                    <>
                      <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-gray-400 text-sm">Video işlenirken hata oluştu.</p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 border-[3px] border-brand-500/30 border-t-brand-400 rounded-full animate-spin" />
                      <p className="text-gray-400 text-sm">Video işleniyor, lütfen bekleyin...</p>
                      <p className="text-gray-600 text-xs">Uzun videolar birkaç dakika sürebilir</p>
                    </>
                  )}
                </div>
              ) : instreamSlot?.enabled && showInstream ? (
                <InstreamVideoAd onSkip={() => setShowInstream(false)} />
              ) : (
                <VideoPlayer
                  src={video.videoUrl}
                  poster={video.thumbnailUrl}
                  title={video.title}
                  videoId={video._id}
                  mp4FallbackUrl={video.mp4FallbackUrl || null}
                  onWatchProgress={handleWatchProgress}
                />
              )}
            </div>

            {/* Title */}
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white mt-5 mb-2 leading-tight">
              {video.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-surface-700/50">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <strong className="text-white">{formatViews(video.views)}</strong> izlenme
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(new Date(video.createdAt), "d MMM yyyy", { locale: tr })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigator.clipboard?.writeText(window.location.href)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Paylaş
                </button>
                <a
                  href={`/embed/${video._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Embed
                </a>
              </div>
            </div>

            {/* Description with injected links */}
            {video.description && (
              <div className="mt-4 bg-surface-800/60 rounded-xl p-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                  {descExpanded ? (
                    <LinkedDescription
                      text={video.description}
                      tags={tags}
                      relatedVideos={related}
                      categories={[...(video.categories || []), ...(video.category ? [video.category] : [])]}
                    />
                  ) : (
                    <>
                      <LinkedDescription
                        text={shortDesc}
                        tags={tags}
                        relatedVideos={related}
                        categories={[...(video.categories || []), ...(video.category ? [video.category] : [])]}
                      />
                      {hasLongDesc && "..."}
                    </>
                  )}
                </p>
                {hasLongDesc && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-brand-400 hover:text-brand-300 text-sm font-medium mt-2 transition-colors"
                  >
                    {descExpanded ? "Daha az göster" : "Daha fazla göster"}
                  </button>
                )}
              </div>
            )}

            {/* Tags — each is a clickable link to /tag/:tag */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/tag/${encodeURIComponent(tag.toLowerCase())}`}
                    className="text-xs bg-surface-800 text-brand-400 px-2.5 py-1 rounded-full border border-brand-500/20 font-mono hover:bg-brand-500/15 hover:border-brand-500/50 transition-all"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <BelowDescriptionAd />

            {/* ── Mobile: watch next + related grid ───────────────────── */}
            <div className="lg:hidden mt-6 space-y-6">
              {watchNext && <WatchNextCard video={watchNext} />}
              {related.length > 0 && (
                <div>
                  <h2 className="font-display font-bold text-base text-white mb-4">
                    Benzer Videolar
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-5">
                    {related.map((v) => <VideoCard key={v._id} video={v} />)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: related sidebar (desktop only) ────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-3 w-[340px] xl:w-[380px] flex-shrink-0">
            {watchNext && <WatchNextCard video={watchNext} />}

            {sidebarList.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-3">
                  Benzer Videolar
                </p>
                <div className="space-y-1">
                  {sidebarList.map((v) => <RelatedMiniCard key={v._id} video={v} />)}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
