import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import toast from "react-hot-toast";
import { videoApi, commentApi } from "../api";
import VideoPlayer from "../components/VideoPlayer";
import VideoCard from "../components/VideoCard";
import { VideoDetailSkeleton } from "../components/Skeletons";
import { TopBannerAd, InstreamVideoAd, BelowDescriptionAd, InFeedAd } from "../components/AdPlaceholders";
import { useAds } from "../context/AdsContext";
import SEOHead from "../components/SEOHead";
import { parseLinkedDescription } from "../lib/linkedDescription";

function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n?.toString() || "0";
}

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

function LikeButton({ videoId, initialLikes }) {
  const [likes, setLikes]   = useState(initialLikes || 0);
  const [liked, setLiked]   = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("likedVideos") || "[]").includes(videoId);
    } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    const next = !liked;
    setLiked(next);
    setLikes(n => next ? n + 1 : Math.max(0, n - 1));
    try {
      const stored = JSON.parse(localStorage.getItem("likedVideos") || "[]");
      localStorage.setItem("likedVideos", JSON.stringify(
        next ? [...stored, videoId] : stored.filter(id => id !== videoId)
      ));
      setBusy(true);
      await videoApi.like(videoId, next);
    } catch {
      setLiked(!next);
      setLikes(n => next ? Math.max(0, n - 1) : n + 1);
    } finally { setBusy(false); }
  }

  return (
    <button onClick={handle}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
        liked
          ? "text-brand-400 bg-brand-500/12 hover:bg-brand-500/18"
          : "text-neutral-500 hover:text-white hover:bg-white/5"
      }`}>
      <svg className="w-3.5 h-3.5" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 1.81L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
      {likes > 0 ? `Beğen (${likes.toLocaleString("tr-TR")})` : "Beğen"}
    </button>
  );
}

function CommentSection({ videoId }) {
  const [comments,  setComments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [hasMore,   setHasMore]   = useState(false);
  const [username,  setUsername]  = useState(() => localStorage.getItem("commenterUsername") || "");
  const [nameMode,  setNameMode]  = useState(!localStorage.getItem("commenterUsername"));
  const [nameInput, setNameInput] = useState("");
  const [text,      setText]      = useState("");
  const [submitting,setSubmitting]= useState(false);
  const pageRef = useRef(1);

  useEffect(() => { load(1, false); }, [videoId]);

  async function load(page, append) {
    try {
      const res = await commentApi.getByVideo(videoId, { page, limit: 10 });
      setComments(prev => append ? [...prev, ...res.data] : res.data);
      setHasMore(page < (res.pagination?.pages ?? 1));
      pageRef.current = page;
    } catch {}
    finally { setLoading(false); }
  }

  function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    localStorage.setItem("commenterUsername", n);
    setUsername(n);
    setNameMode(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || !username) return;
    setSubmitting(true);
    try {
      const res = await commentApi.add(videoId, { username, text: text.trim() });
      setComments(prev => [res.data, ...prev]);
      setText("");
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mt-10">
      <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-5">
        Yorumlar {comments.length > 0 && <span className="text-neutral-700">({comments.length})</span>}
      </h2>

      {nameMode ? (
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <input value={nameInput} onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
            placeholder="Kullanıcı adın..."
            maxLength={30}
            className="flex-1 bg-white/[0.04] border border-white/8 focus:border-brand-500/50 text-white placeholder-neutral-700 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" />
          <button onClick={saveName} className="btn-primary text-sm px-5 py-2.5 sm:py-0">Kaydet</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-500 font-semibold">{username}</span>
            <button type="button" onClick={() => setNameMode(true)} className="text-neutral-700 hover:text-neutral-400 transition-colors underline underline-offset-2">Değiştir</button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder="Yorum yaz..."
              maxLength={500}
              className="flex-1 bg-white/[0.04] border border-white/8 focus:border-brand-500/50 text-white placeholder-neutral-700 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" />
            <button type="submit" disabled={submitting || !text.trim()} className="btn-primary text-sm px-5 py-2.5 sm:py-0 disabled:opacity-40">
              {submitting ? "..." : "Gönder"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-neutral-700 text-sm text-center py-8">Henüz yorum yok — ilk yorumu sen yap!</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c._id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-brand-500 text-xs font-semibold">{c.username}</span>
                <span className="text-neutral-700 text-xs">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: tr })}</span>
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => load(pageRef.current + 1, true)}
              className="w-full text-xs text-neutral-700 hover:text-neutral-400 py-3 transition-colors border border-white/5 rounded-xl hover:border-white/10">
              Daha fazla yorum yükle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function VideoDetail() {
  const { slug }   = useParams();
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
  const skipFetchRef = useRef(false);

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
    if (skipFetchRef.current) { skipFetchRef.current = false; return; }
    setLoading(true);
    setError(null);
    setDescExpanded(false);
    setShowInstream(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    videoApi.getById(slug)
      .then((res) => {
        setVideo(res.data);
        setRelated(res.related || []);
        if (/^[a-f\d]{24}$/i.test(slug) && res.data.slug) {
          skipFetchRef.current = true;
          navigate(`/video/${res.data.slug}`, { replace: true });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <VideoDetailSkeleton />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 flex flex-col items-center gap-5 text-center animate-fade-in">
        <div className="w-14 h-14 bg-red-500/8 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  return (
    <>
      <SEOHead
        title={video.title}
        description={
          video.description?.slice(0, 160) ||
          `${video.title}${tags.length ? ` — ${tags.slice(0,3).join(", ")}` : ""} videosu xxxporeda'da ücretsiz izle.`
        }
        image={video.thumbnailUrl}
        url={`/video/${video.slug || video._id}`}
        type="video.other"
        videoUrl={video.mp4FallbackUrl || null}
        videoObject={video}
      />

      <div className="max-w-5xl mx-auto animate-fade-in">

        {/* Top ad */}
        <div className="px-3 sm:px-6 pt-3 sm:pt-5">
          <TopBannerAd />
        </div>

        {/* Player — full-bleed mobile, rounded sm+ */}
        <div className="sm:px-6 sm:pt-3">
          {video.status === "error" ? (
            <div className="w-full aspect-video bg-neutral-900 sm:rounded-2xl flex flex-col items-center justify-center gap-3">
              <svg className="w-8 h-8 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-neutral-500 text-sm">Video işlenirken hata oluştu.</p>
            </div>
          ) : video.status === "processing" || (!video.videoUrl && !video.previewVideoUrl) ? (
            <div className="w-full aspect-video bg-neutral-900 sm:rounded-2xl flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-[3px] border-brand-500/25 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-neutral-500 text-sm">Video işleniyor...</p>
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
                subtitleUrl={video.subtitleUrl ? `${(import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "")}/api/subtitle/${video._id}` : null}
                onWatchProgress={handleWatchProgress}
              />
              {video.status === "uploaded" && (
                <div className="flex items-center gap-2 mt-2 mx-3 sm:mx-0 px-3 py-2 rounded-lg bg-brand-500/8 border border-brand-500/15 text-xs text-brand-400/80">
                  <div className="w-3 h-3 border-2 border-brand-500/30 border-t-brand-500/70 rounded-full animate-spin flex-shrink-0" />
                  HD sürüm hazırlanıyor — şu an önizleme oynatılıyor
                </div>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="px-3 sm:px-6 pb-8">
        <div>

          {/* Title */}
          <h1 className="font-semibold text-base sm:text-xl text-white mt-3 sm:mt-4 mb-3 leading-snug">
            {video.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-neutral-600">
              <span>
                <strong className="text-neutral-300 font-semibold">
                  {formatViews(video.displayViews ?? video.views)}
                </strong> izlenme
              </span>
              <span className="text-neutral-700">&middot;</span>
              <span>{format(new Date(video.createdAt), "d MMM yyyy", { locale: tr })}</span>
            </div>
            <div className="flex gap-0.5">
              <LikeButton videoId={video._id} initialLikes={video.likes} />
              <button
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Paylaş</span>
              </button>
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="mt-3 bg-white/[0.045] rounded-xl p-3 sm:p-4">
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
                  className="text-brand-500 hover:text-brand-400 text-xs font-semibold mt-2 transition-colors">
                  {descExpanded ? "Daha az göster" : "Daha fazla göster"}
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <Link key={tag} to={`/tag/${encodeURIComponent(tag.toLowerCase().replace(/\s+/g, "-"))}`}
                  className="text-[11px] text-neutral-600 hover:text-brand-400 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-brand-500/8 border border-white/[0.05] hover:border-brand-500/20 transition-all font-mono">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <BelowDescriptionAd />

          {/* Related videos */}
          {related.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-4">
                Benzer Videolar
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5">
                {related.reduce((acc, v, i) => {
                  acc.push(<VideoCard key={v._id} video={v} />);
                  if ((i + 1) % 5 === 0 && i < related.length - 1) acc.push(<InFeedAd key={`ad-${i}`} />);
                  return acc;
                }, [])}
              </div>
            </div>
          )}

          {/* Comments */}
          <CommentSection videoId={video._id} />

        </div>

        </div>
      </div>
    </>
  );
}
