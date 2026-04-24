import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { videoApi, categoryApi } from "../api";
import VideoCard from "../components/VideoCard";
import { VideoGridSkeleton } from "../components/Skeletons";
import SEOHead from "../components/SEOHead";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";

const PAGE_LIMIT = 24;
const AD_EVERY   = 5;
const SITE_URL   = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";

function buildCategoryDescription(cat, total) {
  const name  = cat.name;
  const count = total ? total.toLocaleString("tr-TR") : "yüzlerce";
  return `${name} porno videolarını ücretsiz HD kalitede izle. ${count} adet ${name} videosu seni bekliyor. En iyi ${name} içerikleri yüksek çözünürlük ve net ses kalitesiyle sunulmaktadır. Tüm ${name} videolarını kayıt olmadan ücretsiz seyret.`;
}

export default function CategoryPage() {
  const { slug }              = useParams();
  const [category, setCategory] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [videos,   setVideos]   = useState([]);
  const [total,    setTotal]    = useState(null);
  const [hasMore,  setHasMore]  = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,    setError]    = useState(null);
  const [maxPage,  setMaxPage]  = useState(1);
  const pageRef    = useRef(1);
  const fetchIdRef = useRef(0);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px", threshold: 0 });

  const fetchVideos = useCallback(async (page, append, catId) => {
    if (!catId) return;
    const id = ++fetchIdRef.current;
    if (!append) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const res = await videoApi.getAll({ page, limit: PAGE_LIMIT, category: catId, sort: "algo" });
      if (id !== fetchIdRef.current) return;
      setVideos((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.pagination?.total ?? null);
      setHasMore(page < (res.pagination?.pages ?? 1));
      pageRef.current = page;
      setMaxPage((prev) => Math.max(prev, page));
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      setError(err.message);
    } finally {
      if (id !== fetchIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setCategory(null);
    setNotFound(false);
    setVideos([]);
    setTotal(null);
    setHasMore(true);
    setMaxPage(1);
    pageRef.current = 1;
    window.scrollTo({ top: 0, behavior: "instant" });

    categoryApi.getBySlug(slug)
      .then((res) => {
        setCategory(res.data);
        fetchVideos(1, false, res.data._id);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore && category) {
      fetchVideos(pageRef.current + 1, true, category._id);
    }
  }, [inView]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4">
        <p className="text-white font-semibold text-lg">Kategori bulunamadı</p>
        <Link to="/" className="text-brand-500 hover:underline text-sm">Ana Sayfaya Dön</Link>
      </div>
    );
  }

  const catBase      = category ? `/kategori/${category.slug}` : "";
  const prevPage     = maxPage > 1 ? `${catBase}?page=${maxPage - 1}` : null;
  const nextPage     = hasMore   ? `${catBase}?page=${maxPage + 1}` : null;
  const seoTitle     = category ? `${category.name} Porno Videoları` : "";
  const seoDesc      = category ? buildCategoryDescription(category, total).slice(0, 160) : "";
  const itemListData = videos.slice(0, 10).map((v) => ({
    name: v.title,
    url:  `${SITE_URL}/video/${v.slug || v._id}`,
  }));

  return (
    <>
      {category && (
        <SEOHead
          title={seoTitle}
          description={seoDesc}
          url={maxPage > 1 ? `${catBase}?page=${maxPage}` : catBase}
          prevPage={prevPage}
          nextPage={nextPage}
          breadcrumbs={[
            { name: "xxxporeda", url: SITE_URL },
            { name: seoTitle,    url: `${SITE_URL}${catBase}` },
          ]}
          itemList={itemListData.length > 0 ? itemListData : null}
        />
      )}

      <div className="max-w-[1600px] mx-auto px-2 sm:px-5 py-4">

        <TopBannerAd />

        {/* Page header */}
        <div className="flex items-center gap-3 mb-4">
          {category?.icon && (
            <div className="w-9 h-9 bg-brand-500/12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
              {category.icon}
            </div>
          )}
          {!category?.icon && (
            <div className="w-9 h-9 bg-brand-500/12 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-brand-500 font-bold text-lg">🎬</span>
            </div>
          )}
          <div>
            {category ? (
              <>
                <h1 className="font-display font-bold text-lg sm:text-2xl text-white leading-tight">
                  {seoTitle}
                </h1>
                {total != null && (
                  <p className="text-neutral-700 text-xs mt-0.5">
                    {total.toLocaleString("tr-TR")} video
                  </p>
                )}
              </>
            ) : (
              <div className="skeleton h-7 w-48 rounded" />
            )}
          </div>
        </div>

        {/* SEO description text */}
        {category && total != null && (
          <p className="text-neutral-700 text-xs leading-relaxed mb-5 max-w-3xl">
            {buildCategoryDescription(category, total)}
          </p>
        )}

        {/* Video grid */}
        {loading && <VideoGridSkeleton count={PAGE_LIMIT} />}

        {!loading && error && (
          <p className="text-red-400 text-sm text-center py-10">{error}</p>
        )}

        {!loading && !error && videos.length === 0 && (
          <p className="text-neutral-500 text-sm text-center py-10">Bu kategoride henüz video yok.</p>
        )}

        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {videos.map((video, i) => (
              <>
                <VideoCard key={video._id} video={video} />
                {(i + 1) % AD_EVERY === 0 && (
                  <div key={`ad-${i}`} className="col-span-full">
                    <InFeedAd />
                  </div>
                )}
              </>
            ))}
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-[3px] border-white/10 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />

        {/* Breadcrumb nav */}
        <nav className="mt-8 text-xs text-neutral-600" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand-400">Ana Sayfa</Link>
          <span className="mx-1">/</span>
          {category && <span className="text-neutral-400">{category.name}</span>}
        </nav>
      </div>
    </>
  );
}
