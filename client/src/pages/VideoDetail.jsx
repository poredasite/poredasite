import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";
import { videoApi } from "../api";
import VideoPlayer from "../components/VideoPlayer";
import VideoCard from "../components/VideoCard";
import { VideoDetailSkeleton } from "../components/Skeletons";
import { SidebarAd, InstreamVideoAd } from "../components/AdPlaceholders";
import { useAds } from "../context/AdsContext";
import SEOHead from "../components/SEOHead";

function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n?.toString() || "0";
}

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showInstream, setShowInstream] = useState(true);
  const { getSlot } = useAds();
  const instreamSlot = getSlot("instreamVideo");

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
              d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
        </div>
        <h1 className="text-white font-display font-bold text-2xl">Video bulunamadı</h1>
        <p className="text-gray-500">{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          ← Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  if (!video) return null;

  const shortDesc = video.description?.slice(0, 200);
  const hasLongDesc = video.description?.length > 200;

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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row gap-5 xl:gap-8">

          {/* ── Main column ───────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Instream / Video Player */}
            {instreamSlot?.enabled && showInstream
              ? <InstreamVideoAd onSkip={() => setShowInstream(false)} />
              : <VideoPlayer src={video.videoUrl} poster={video.thumbnailUrl} title={video.title} />
            }

            {/* Video title */}
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white mt-5 mb-2 leading-tight">
              {video.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4
                            border-b border-surface-700/50">
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

              {/* Paylaş button */}
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white
                           transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Paylaş
              </button>
            </div>

            {/* Description */}
            {video.description && (
              <div className="mt-4 bg-surface-800/60 rounded-xl p-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                  {descExpanded ? video.description : shortDesc}
                  {hasLongDesc && !descExpanded && "..."}
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

            {/* Tags */}
            {video.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-surface-800 text-brand-400 px-2.5 py-1 rounded-full
                               border border-brand-500/20 font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Mobile: related videos */}
            {related.length > 0 && (
              <div className="xl:hidden mt-6">
                <h2 className="font-display font-bold text-base text-white mb-3">
                  Sıradaki
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {related.slice(0, 6).map((v) => (
                    <VideoCard key={v._id} video={v} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ────────────────────────────────────────────── */}
          <div className="hidden xl:block xl:w-80 2xl:w-96 flex-shrink-0 space-y-5">
            {/* Sidebar Ad */}
            <SidebarAd />

            {/* Related Videos */}
            {related.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-base text-white mb-3">
                  Sıradaki
                </h2>
                <div className="space-y-3">
                  {related.map((v) => (
                    <Link
                      key={v._id}
                      to={`/video/${v._id}`}
                      className="flex gap-3 group rounded-xl p-2 hover:bg-surface-800
                                 transition-colors duration-200"
                    >
                      {/* Thumbnail */}
                      <div className="w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-surface-800">
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105
                                     transition-transform duration-300"
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-white text-xs font-display font-semibold
                                      line-clamp-2 group-hover:text-brand-300 transition-colors">
                          {v.title}
                        </p>
                        <p className="text-gray-500 text-xs mt-1.5">
                          {formatViews(v.views)} izlenme
                        </p>
                        <p className="text-gray-600 text-xs">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
