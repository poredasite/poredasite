import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { videoApi } from "../api";
import VideoCard from "../components/VideoCard";
import SidebarLinks from "../components/SidebarLinks";
import { VideoGridSkeleton } from "../components/Skeletons";
import SEOHead from "../components/SEOHead";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";

const PAGE_LIMIT = 24;
const AD_EVERY = 12;
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";

function buildTagDescription(tag, total) {
  const count = total ? total.toLocaleString("tr-TR") : "yüzlerce";
  return `${tag} videolarını ücretsiz HD kalitede izle. Sitemizde ${count} adet ${tag} videosu seni bekliyor — amatörden profesyonele, kısa klipler ve uzun filmler. En kaliteli ${tag} içerikleri, yüksek çözünürlüklü görüntü ve net ses kalitesiyle sunulmaktadır. ${tag} kategorisine yeni videolar düzenli olarak eklenmektedir. Tüm ${tag} videolarını kayıt olmadan, tamamen ücretsiz seyredebilirsin. En çok izlenen ${tag} videolarını keşfet, beğendiklerini arkadaşlarınla paylaş.`;
}

export default function TagPage() {
  const { tag }               = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const decoded               = decodeURIComponent(tag);

  const initialPage           = Math.max(1, parseInt(searchParams.get("page") || "1"));

  const [videos,      setVideos]      = useState([]);
  const [total,       setTotal]       = useState(null);
  const [hasMore,     setHasMore]     = useState(true);
  const [maxPage,     setMaxPage]     = useState(initialPage);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [meta,        setMeta]        = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const pageRef    = useRef(initialPage);
  const fetchIdRef = useRef(0);
  const categoryMountRef = useRef(false);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px", threshold: 0 });

  const fetchVideos = useCallback(async (page, append, categoryId) => {
    const id = ++fetchIdRef.current;
    if (!append) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const params = { page, limit: PAGE_LIMIT };
      if (categoryId) params.category = categoryId;
      const res = await videoApi.getByTag(decoded, params);
      if (id !== fetchIdRef.current) return;
      setVideos((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.pagination?.total ?? null);
      const totalPages = res.pagination?.pages ?? 1;
      setHasMore(page < totalPages);
      pageRef.current = page;
      setMaxPage((prev) => Math.max(prev, page));

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

  useEffect(() => {
    categoryMountRef.current = false;
    pageRef.current = 1;
    setMaxPage(1);
    setVideos([]);
    setHasMore(true);
    setMeta(null);
    setActiveCategory(null);
    fetchVideos(1, false, null);
    window.scrollTo({ top: 0, behavior: "instant" });
    videoApi.getTagMeta(decoded).then((res) => setMeta(res.data)).catch(() => {});
  }, [decoded]);

  useEffect(() => {
    if (!categoryMountRef.current) { categoryMountRef.current = true; return; }
    pageRef.current = 1;
    setMaxPage(1);
    setVideos([]);
    setHasMore(true);
    fetchVideos(1, false, activeCategory);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeCategory]);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      fetchVideos(pageRef.current + 1, true, activeCategory);
    }
  }, [inView]);

  const tagBase  = `/tag/${encodeURIComponent(decoded.toLowerCase().replace(/\s+/g, "-"))}`;
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

        <TopBannerAd />

        {/* Page header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-brand-500/12 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-brand-500 font-bold text-lg leading-none">#</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg sm:text-2xl text-white leading-tight">
              {decoded} videoları
            </h1>
            {total != null && (
              <p className="text-neutral-700 text-xs mt-0.5">
                {total.toLocaleString("tr-TR")} video
              </p>
            )}
          </div>
        </div>

        {/* SEO description */}
        {total != null && (
          <p className="text-neutral-700 text-xs leading-relaxed mb-5 max-w-3xl">
            {buildTagDescription(decoded, total)}
          </p>
        )}

        {/* Related tags */}
        {meta?.relatedTags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            <span className="text-neutral-700 text-xs self-center mr-1">İlgili:</span>
            {meta.relatedTags.map((t) => (
              <Link
                key={t}
                to={`/tag/${encodeURIComponent(t.toLowerCase().replace(/\s+/g, "-"))}`}
                className="text-[11px] bg-white/[0.04] text-neutral-500 hover:text-brand-400 px-2.5 py-1 rounded-md border border-white/[0.05] hover:border-brand-500/20 transition-all font-mono"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {/* Category filter pills */}
        {meta?.categories?.length > 0 && (
          <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
                !activeCategory
                  ? "bg-brand-500 text-white"
                  : "bg-white/5 text-neutral-500 hover:text-white hover:bg-white/8"
              }`}
            >
              Tümü
            </button>
            {meta.categories.map((c) => (
              <button
                key={c._id}
                onClick={() => setActiveCategory(activeCategory === c._id ? null : c._id)}
                className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
                  activeCategory === c._id
                    ? "bg-brand-500 text-white"
                    : "bg-white/5 text-neutral-500 hover:text-white hover:bg-white/8"
                }`}
              >
                {c.icon && <span className="mr-1">{c.icon}</span>}{c.name}
              </button>
            ))}
          </div>
        )}

        {/* Video grid */}
        {loading && <VideoGridSkeleton count={PAGE_LIMIT} />}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm mb-3">Yüklenemedi</p>
            <button onClick={() => fetchVideos(1, false)} className="btn-primary text-sm">Tekrar Dene</button>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-20 space-y-2">
            <p className="text-white font-semibold">Video bulunamadı</p>
            <p className="text-neutral-600 text-sm">"{decoded}" etiketi için henüz video yok.</p>
          </div>
        )}

        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 animate-fade-in">
            {videos.reduce((acc, v, i) => {
              acc.push(<VideoCard key={v._id} video={v} priority={i < 6} />);
              if ((i + 1) % AD_EVERY === 0 && i < videos.length - 1) acc.push(<InFeedAd key={`ad-${i}`} />);
              return acc;
            }, [])}
          </div>
        )}

        {loadingMore && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 mt-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton rounded-xl" style={{ aspectRatio: "16/9" }} />
                <div className="skeleton h-3.5 rounded w-3/4" />
                <div className="skeleton h-3 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && !loadingMore && !hasMore && videos.length > 0 && (
          <div className="text-center py-10 text-neutral-700 text-xs">
            — Tüm videolar yüklendi —
          </div>
        )}

        <div ref={sentinelRef} className="h-1" />

        <div className="mt-10">
          <SidebarLinks />
        </div>
      </div>
    </>
  );
}
