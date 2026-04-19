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
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

// ── LinkedDescription ─────────────────────────────────────────────────────────
function LinkedDescription({ text, tags, relatedVideos, categories }) {
  const segments = parseLinkedDescription(text, { tags, relatedVideos, categories });
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <Link key={i} to={seg.href}
            className="text-brand-400 hover:text-brand-300 underline underline-offset-2 decoration-brand-500/30 transition-colors">
            {seg.content}
          </Link>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}

// ── WatchNextCard ─────────────────────────────────────────────────────────────
function WatchNextCard({ video }) {
  const d = formatDuration(video.duration);
  return (
    <Link to={`/video/${video._id}`}
      className="flex gap-4 group p-3 rounded-xl hover:bg-white/5 transition-colors border border-white/5 hover:border-white/10">
      <div className="relative flex-shrink-0 w-40 sm:w-48 rounded-lg overflow-hidden bg-neutral-900"
        style={{ aspectRatio: "16/9" }}>
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt={video.title} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
        {d && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 py-0.5 rounded">
            {d}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 py-1">
        <p className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider mb-1.5">Sıradaki</p>
        <p className="text-white text-sm font-medium leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {video.title}
        </p>
        <p className="text-neutral-500 text-xs mt-2">{formatViews(video.views)} izlenme</p>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VideoDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [video,        setVideo]        = useState(null);
  const [related,      setRelated]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showInstream, setShowInstream] = useState(true);
  const { getSlot }  = useAds();
  const instreamSlot = getSlot("instreamVideo");
  const lastWatchRef = useRef(null);

  // Watch time: flush via sendBeacon on tab hide
  useEffect(() => {
    if (!video?._id) return;
    const onHide = () => {
      const d = lastWatchRef.current;
      if (!d || d.watchedSeconds < 5) return;
      const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      navigator.sendBeacon?.(
        `${base}/videos/${video._id}/watch`,
        new Blob([JSON.stringify({ watchTime: d.watchedSeconds, duration: d.duration })], { type: "application/json" })
      );
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [video?._id]);

  const handleWatchProgress = useCallback(({ watchedSeconds, duration }) => {
    lastWatchRef.current = { watchedSeconds, duration };
    if (watchedSeconds >= 10 && video?._id)
      videoApi.recordWatch(video._id, { watchTime: watchedSeconds, duration }).catch(() => {});
  }, [video?._id]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDescExpanded(false);
    setShowInstream(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    videoApi.getById(id)
      .then((res) => { setVideo(res.data); setRelated(res.related || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <VideoDetailSkeleton />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 flex flex-col items-center gap-5 text-center animate-fade-in">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-white font-semibold text-xl">Video bulunamadı</h1>
        <button onClick={() => navigate("/")} className="btn-primary">← Ana Sayfaya Dön</button>
      </div>
    );
  }

  if (!video) return null;

  const shortDesc   = video.description?.slice(0, 200);
  const hasLongDesc = video.description?.length > 200;
  const tags        = video.tags || [];
  const cats        = [...(video.categories || []), ...(video.category ? [video.category] : [])];
  const watchNext   = related[0] || null;

  return (
    <>
      <SEOHead
        title={video.title}
        description={video.description?.slice(0, 160) || `"${video.title}" izle`}
        image={video.thumbnailUrl}
        url={`/video/${video._id}`}
        type="video.other"
        videoObject={video}
      />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 animate-fade-in">
        <TopBannerAd />

        {/* ── Player ─────────────────────────────────────────────────── */}
        {video.status === "error" ? (
          <div className="w-full aspect-video bg-neutral-900 rounded-2xl flex flex-col items-center justify-center gap-3">
            <svg className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-neutral-400 text-sm">Video işlenirken hata oluştu.</p>
          </div>
        ) : video.status === "processing" || (!video.videoUrl && !video.previewVideoUrl) ? (
          <div className="w-full aspect-video bg-neutral-900 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-[3px] border-brand-500/30 border-t-brand-400 rounded-full animate-spin" />
            <p className="text-neutral-400 text-sm">Video işleniyor...</p>
          </div>
        ) : instreamSlot?.enabled && showInstream ? (
          <InstreamVideoAd onSkip={() => setShowInstream(false)} />
        ) : (
          <>
            <VideoPlayer
              src={video.videoUrl || video.previewVideoUrl}
              poster={video.thumbnailUrl}
              title={video.title}
              videoId={video._id}
              mp4FallbackUrl={video.mp4FallbackUrl || null}
              onWatchProgress={handleWatchProgress}
            />
            {/* Show banner while HLS is still encoding (preview is playing) */}
            {video.status === "uploaded" && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-brand-400">
                <div className="w-3 h-3 border-2 border-brand-500/40 border-t-brand-400 rounded-full animate-spin flex-shrink-0" />
                HD sürüm hazırlanıyor — şu an önizleme oynatılıyor
              </div>
            )}
          </>
        )}

        {/* ── Title ──────────────────────────────────────────────────── */}
        <h1 className="font-semibold text-lg sm:text-xl text-white mt-4 mb-3 leading-snug">
          {video.title}
        </h1>

        {/* ── Meta row ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span><strong className="text-neutral-300">{formatViews(video.views)}</strong> izlenme</span>
            <span>{format(new Date(video.createdAt), "d MMM yyyy", { locale: tr })}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Paylaş
            </button>
            <a href={`/embed/${video._id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Embed
            </a>
          </div>
        </div>

        {/* ── Description ────────────────────────────────────────────── */}
        {video.description && (
          <div className="mt-4 bg-white/[0.03] rounded-xl p-4">
            <p className="text-neutral-400 text-sm leading-relaxed whitespace-pre-line">
              {descExpanded ? (
                <LinkedDescription text={video.description} tags={tags} relatedVideos={related} categories={cats} />
              ) : (
                <>
                  <LinkedDescription text={shortDesc} tags={tags} relatedVideos={related} categories={cats} />
                  {hasLongDesc && "..."}
                </>
              )}
            </p>
            {hasLongDesc && (
              <button onClick={() => setDescExpanded(!descExpanded)}
                className="text-brand-400 hover:text-brand-300 text-xs font-medium mt-2.5 transition-colors">
                {descExpanded ? "Daha az" : "Daha fazla göster"}
              </button>
            )}
          </div>
        )}

        {/* ── Tags ───────────────────────────────────────────────────── */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {tags.map((tag) => (
              <Link key={tag} to={`/tag/${encodeURIComponent(tag.toLowerCase().replace(/\s+/g, "-"))}`}
                className="text-[11px] text-neutral-500 hover:text-brand-400 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-brand-500/10 border border-white/5 hover:border-brand-500/20 transition-all font-mono">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <BelowDescriptionAd />

        {/* ── Watch Next ─────────────────────────────────────────────── */}
        {watchNext && (
          <div className="mt-8">
            <WatchNextCard video={watchNext} />
          </div>
        )}

        {/* ── Related videos ─────────────────────────────────────────── */}
        {related.length > 1 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              Benzer Videolar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {related.slice(1).map((v) => <VideoCard key={v._id} video={v} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
