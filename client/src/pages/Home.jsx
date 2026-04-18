import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { videoApi, categoryApi } from "../api";
import VideoCard from "../components/VideoCard";
import { VideoGridSkeleton } from "../components/Skeletons";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";
import SEOHead from "../components/SEOHead";
import { HiFire, HiClock } from "react-icons/hi";

const PAGE_LIMIT = 24;
const AD_EVERY = 12;

// ── Category bar ───────────────────────────────────────────────────
function CategoryBar({ activeCategory, onSelect }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryApi.getAll()
      .then((res) => setCategories(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5 -mx-1 px-1">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap touch-manipulation
          ${!activeCategory
            ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
            : "bg-surface-800 text-gray-400 border border-white/8 hover:border-brand-500/40 hover:text-white"}`}
      >
        Tümü
      </button>

      {loading && Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-20 rounded-full flex-shrink-0" />
      ))}

      {categories.map((cat) => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat._id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap touch-manipulation
            ${activeCategory === cat._id
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-surface-800 text-gray-400 border border-white/8 hover:border-brand-500/40 hover:text-white"}`}
        >
          {cat.name}
          {cat.videoCount > 0 && (
            <span className="ml-1.5 text-xs opacity-40">{cat.videoCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get("sort") || "createdAt";
  const activeCategory = searchParams.get("category") || null;

  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);
  const fetchIdRef = useRef(0);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px", threshold: 0 });

  const fetchVideos = useCallback(async (page, append) => {
    const id = ++fetchIdRef.current;
    if (!append) { setLoading(true); setError(null); }
    else setLoadingMore(true);

    try {
      const params = { page, limit: PAGE_LIMIT, sort };
      if (activeCategory) params.category = activeCategory;
      const res = await videoApi.getAll(params);
      if (id !== fetchIdRef.current) return;

      setVideos((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.pagination?.total ?? null);
      setHasMore(page < (res.pagination?.pages ?? 1));
      pageRef.current = page;
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      setError(err.message);
    } finally {
      if (id !== fetchIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort, activeCategory]);

  // Reset + reload on filter change
  useEffect(() => {
    pageRef.current = 1;
    setVideos([]);
    setHasMore(true);
    fetchVideos(1, false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [sort, activeCategory]);

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      fetchVideos(pageRef.current + 1, true);
    }
  }, [inView]);

  function handleCategorySelect(catId) {
    const next = new URLSearchParams(searchParams);
    if (catId) next.set("category", catId);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  }

  function handleSortChange(value) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "createdAt") next.set("sort", value);
    else next.delete("sort");
    setSearchParams(next, { replace: true });
  }

  // Build grid items with ads injected every AD_EVERY videos
  const gridItems = videos.reduce((acc, video, i) => {
    acc.push({ type: "video", video, key: video._id });
    if ((i + 1) % AD_EVERY === 0 && i < videos.length - 1) {
      acc.push({ type: "ad", key: `ad-${i}` });
    }
    return acc;
  }, []);

  return (
    <>
      <SEOHead
        title="Porno izle, Sikiş seyret"
        description="Porno izle Türk ❤️ Porn sex video ☘️ xxxporeda inanılmaz Amatör porna ve sikiş filmleri seyret ⭐ altyazılı Full HD pornosu ⭐ endişe verici Türkçe dublaj pornolar."
        url="/"
      />

      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-4">

        <TopBannerAd />

        <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
              sort === "views" ? "bg-brand-500/20 text-brand-400" : "bg-surface-700 text-gray-400"
            }`}>
              {sort === "views" ? <HiFire className="w-4 h-4" /> : <HiClock className="w-4 h-4" />}
            </div>
            <div>
              <h1 className="font-display font-bold text-base sm:text-lg text-white leading-tight">
                {sort === "views" ? "En Popüler Videolar" : "Son Yüklenen Videolar"}
              </h1>
              {total != null && (
                <p className="text-gray-600 text-xs mt-0.5">
                  {total.toLocaleString("tr-TR")} video{activeCategory ? " bu kategoride" : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-0.5 bg-surface-900 border border-white/5 rounded-lg p-0.5">
            {[
              { value: "createdAt", label: "Yeni",    Icon: HiClock },
              { value: "views",     label: "Popüler", Icon: HiFire  },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => handleSortChange(value)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all duration-200 touch-manipulation
                  ${sort === value ? "bg-brand-500 text-white shadow-sm" : "text-gray-500 hover:text-white"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading state (initial) */}
        {loading && <VideoGridSkeleton count={PAGE_LIMIT} />}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Yüklenemedi</p>
            <button onClick={() => fetchVideos(1, false)} className="btn-primary text-sm">Tekrar Dene</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white font-display font-semibold">Video bulunamadı</p>
            <p className="text-gray-600 text-sm">
              {activeCategory ? "Bu kategoride henüz video yok." : "Henüz video yüklenmedi."}
            </p>
            {activeCategory && (
              <button onClick={() => handleCategorySelect(null)} className="btn-ghost text-sm mt-1">
                Tüm videolara dön
              </button>
            )}
          </div>
        )}

        {/* Video grid */}
        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 animate-fade-in">
            {gridItems.map((item, idx) =>
              item.type === "ad"
                ? <InFeedAd key={item.key} />
                : <VideoCard key={item.key} video={item.video} priority={idx < 6} />
            )}
          </div>
        )}

        {/* Load-more skeletons */}
        {loadingMore && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 mt-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                <div className="skeleton rounded-xl" style={{ aspectRatio: "16/9" }} />
                <div className="skeleton h-4 rounded w-3/4" />
                <div className="skeleton h-3 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* End of feed */}
        {!loading && !loadingMore && !hasMore && videos.length > 0 && (
          <div className="text-center py-10 text-gray-700 text-sm">
            Tüm videolar yüklendi
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </>
  );
}
