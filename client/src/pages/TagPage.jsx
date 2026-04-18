import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { videoApi } from "../api";
import VideoCard from "../components/VideoCard";
import SidebarLinks from "../components/SidebarLinks";
import { VideoGridSkeleton } from "../components/Skeletons";
import SEOHead from "../components/SEOHead";

const PAGE_LIMIT = 24;
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";

// Generate a 150-250 word SEO description for the tag page
function buildTagDescription(tag, total) {
  const count = total ? total.toLocaleString("tr-TR") : "yüzlerce";
  return `${tag} videolarını ücretsiz HD kalitede izle. Sitemizde ${count} adet ${tag} videosu seni bekliyor — amatörden profesyonele, kısa klipler ve uzun filmler. En kaliteli ${tag} içerikleri, yüksek çözünürlüklü görüntü ve net ses kalitesiyle sunulmaktadır. ${tag} kategorisine yeni videolar düzenli olarak eklenmektedir. Tüm ${tag} videolarını kayıt olmadan, tamamen ücretsiz seyredebilirsin. En çok izlenen ${tag} videolarını keşfet, beğendiklerini arkadaşlarınla paylaş.`;
}

export default function TagPage() {
  const { tag }               = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const decoded               = decodeURIComponent(tag);

  // Page starts from URL param so Google can crawl /tag/x?page=2
  const initialPage           = Math.max(1, parseInt(searchParams.get("page") || "1"));

  const [videos,      setVideos]      = useState([]);
  const [total,       setTotal]       = useState(null);
  const [hasMore,     setHasMore]     = useState(true);
  const [maxPage,     setMaxPage]     = useState(initialPage);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [meta,        setMeta]        = useState(null);   // { relatedTags, categories }
  const pageRef    = useRef(initialPage);
  const fetchIdRef = useRef(0);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px", threshold: 0 });

  const fetchVideos = useCallback(async (page, append) => {
    const id = ++fetchIdRef.current;
    if (!append) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const res = await videoApi.getByTag(decoded, { page, limit: PAGE_LIMIT });
      if (id !== fetchIdRef.current) return;
      setVideos((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.pagination?.total ?? null);
      const totalPages = res.pagination?.pages ?? 1;
      setHasMore(page < totalPages);
      pageRef.current = page;
      setMaxPage((prev) => Math.max(prev, page));

      // Update URL to reflect deepest loaded page (so back-button works)
      if (page > 1) {
        const next = new URLSearchParams(searchParams);
        next.set("page", page);
        window.history.replaceState(null, "", `?${next.toString()}`);
      }
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      setError(err.message);
    } finally {
      if (id !== fetchIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [decoded]);

  // Reset on tag change
  useEffect(() => {
    pageRef.current = 1;
    setMaxPage(1);
    setVideos([]);
    setHasMore(true);
    setMeta(null);
    fetchVideos(1, false);
    window.scrollTo({ top: 0, behavior: "instant" });
    // Fetch tag meta (related tags + categories)
    videoApi.getTagMeta(decoded).then((res) => setMeta(res.data)).catch(() => {});
  }, [decoded]);

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      fetchVideos(pageRef.current + 1, true);
    }
  }, [inView]);

  // Pagination SEO links
  const tagBase  = `/tag/${encodeURIComponent(decoded)}`;
  const prevPage = maxPage > 1 ? `${tagBase}?page=${maxPage - 1}` : null;
  const nextPage = hasMore   ? `${tagBase}?page=${maxPage + 1}` : null;

  const seoDescription = buildTagDescription(decoded, total);

  return (
    <>
      <SEOHead
        title={`${decoded} videoları`}
        description={seoDescription.slice(0, 160)}
        url={maxPage > 1 ? `${tagBase}?page=${maxPage}` : tagBase}
        prevPage={prevPage}
        nextPage={nextPage}
      />

      <div className="max-w-[1600px] mx-auto px-2 sm:px-5 py-4">

        {/* ── Two-column layout ─────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* ── Left: main content ──────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* H1 + count */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-brand-400 font-bold text-xl leading-none">#</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-white">{decoded} videoları</h1>
                {total != null && (
                  <p className="text-gray-600 text-xs mt-0.5">{total.toLocaleString("tr-TR")} video</p>
                )}
              </div>
            </div>

            {/* SEO description paragraph */}
            {total != null && (
              <p className="text-gray-500 text-sm leading-relaxed mb-5 max-w-3xl">
                {buildTagDescription(decoded, total)}
              </p>
            )}

            {/* Related tags */}
            {meta?.relatedTags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-gray-600 text-xs self-center mr-1">İlgili:</span>
                {meta.relatedTags.map((t) => (
                  <Link
                    key={t}
                    to={`/tag/${encodeURIComponent(t.toLowerCase())}`}
                    className="text-xs bg-surface-800 text-gray-400 hover:text-brand-300 px-2.5 py-1 rounded-full border border-white/8 hover:border-brand-500/30 transition-all font-mono"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* Category links */}
            {meta?.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-gray-600 text-xs self-center mr-1">Kategoriler:</span>
                {meta.categories.map((c) => (
                  <Link
                    key={c._id}
                    to={`/?category=${c._id}`}
                    className="text-xs bg-surface-800 text-brand-400 hover:text-brand-300 px-3 py-1 rounded-full border border-brand-500/20 hover:border-brand-500/50 transition-all"
                  >
                    {c.icon && <span className="mr-1">{c.icon}</span>}{c.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Video grid */}
            {loading && <VideoGridSkeleton count={PAGE_LIMIT} />}

            {!loading && error && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-sm mb-3">Yüklenemedi</p>
                <button onClick={() => fetchVideos(1, false)} className="btn-primary text-sm">Tekrar Dene</button>
              </div>
            )}

            {!loading && !error && videos.length === 0 && (
              <div className="text-center py-20 space-y-2">
                <p className="text-white font-display font-semibold">Video bulunamadı</p>
                <p className="text-gray-600 text-sm">"{decoded}" etiketi için henüz video yok.</p>
              </div>
            )}

            {!loading && videos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 animate-fade-in">
                {videos.map((v, i) => <VideoCard key={v._id} video={v} priority={i < 6} />)}
              </div>
            )}

            {loadingMore && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 mt-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2.5">
                    <div className="skeleton rounded-xl" style={{ aspectRatio: "16/9" }} />
                    <div className="skeleton h-4 rounded w-3/4" />
                    <div className="skeleton h-3 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!loading && !loadingMore && !hasMore && videos.length > 0 && (
              <div className="text-center py-10 text-gray-700 text-sm">Tüm videolar yüklendi</div>
            )}

            <div ref={sentinelRef} className="h-1" />
          </div>

          {/* ── Right: sidebar (desktop only) ────────────────────────── */}
          <aside className="hidden lg:block w-[300px] xl:w-[340px] flex-shrink-0 sticky top-20">
            <SidebarLinks />
          </aside>
        </div>
      </div>
    </>
  );
}
