import { useState, useEffect } from "react";
import { videoApi, categoryApi } from "../api";
import VideoCard from "../components/VideoCard";
import { VideoGridSkeleton } from "../components/Skeletons";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";
import SEOHead from "../components/SEOHead";
import { useAds } from "../context/AdsContext";

function CategoryBar({ activeCategory, onSelect }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-5">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
          ${!activeCategory ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-white/8 hover:border-white/20 hover:text-white"}`}
      >
        Tümü
      </button>
      {loading && Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-20 rounded-full flex-shrink-0" />
      ))}
      {!loading && categories.map(cat => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat._id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
            ${activeCategory === cat._id ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-white/8 hover:border-white/20 hover:text-white"}`}
        >
          {cat.name}
          {cat.videoCount > 0 && <span className="ml-1.5 text-xs opacity-60">{cat.videoCount}</span>}
        </button>
      ))}
    </div>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function Home() {
  const { isMobile } = useAds();
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [activeCategory, setActiveCategory] = useState(null);

  const limit = isMobile ? 12 : 24;

  useEffect(() => { fetchVideos(); }, [page, sort, activeCategory, limit]);

  async function fetchVideos() {
    setLoading(true); setError(null);
    try {
      const params = { page, limit, sort };
      if (activeCategory) params.category = activeCategory;
      const res = await videoApi.getAll(params);
      setVideos(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCategorySelect(catId) { setActiveCategory(catId); setPage(1); }

  const gridItems = videos.reduce((acc, video, i) => {
    acc.push({ type: "video", video, key: video._id });
    if ((i + 1) % 12 === 0 && i !== videos.length - 1) acc.push({ type: "ad", key: `ad-${i}` });
    return acc;
  }, []);

  return (
    <>
      <SEOHead title="Porno izle, Sikiş seyret" description="Porno izle Türk ❤️ Porn sex video ☘️ xxxporeda inanılmaz Amatör porna ve sikiş filmleri seyret ⭐ altyazılı Full HD pornosu ⭐ endişe verici Türkçe dublaj pornolar." url="/" />
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-4">
        <TopBannerAd />

        <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display font-bold text-lg text-white">
              {sort === "views" ? "En Popüler Videolar" : "Son Yüklenen Videolar"}
            </h1>
            {pagination && (
              <p className="text-gray-600 text-xs mt-0.5">
                {pagination.total} video{activeCategory ? " bu kategoride" : ""}
              </p>
            )}
          </div>
          <div className="flex gap-0.5 bg-surface-900 border border-white/5 rounded-lg p-0.5">
            {[{ value: "createdAt", label: "Yeni" }, { value: "views", label: "Popüler" }].map((opt) => (
              <button key={opt.value} onClick={() => { setSort(opt.value); setPage(1); }}
                className={`text-sm px-3 py-1.5 rounded-md font-medium transition-all
                  ${sort === opt.value ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <VideoGridSkeleton count={limit} />}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-500">Yüklenemedi: {error}</p>
            <button onClick={fetchVideos} className="btn-primary">Tekrar Dene</button>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-white font-display font-semibold">Video bulunamadı</p>
            <p className="text-gray-600 text-sm">{activeCategory ? "Bu kategoride henüz video yok." : "Henüz video yüklenmedi."}</p>
            {activeCategory && <button onClick={() => handleCategorySelect(null)} className="btn-ghost text-sm">Tüm videolar</button>}
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 animate-fade-in">
              {gridItems.map((item, idx) =>
                item.type === "ad"
                  ? <InFeedAd key={item.key} />
                  : <VideoCard key={item.key} video={item.video} priority={idx < 6} />
              )}
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-10">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">←</button>

                {getPageNumbers(page, pagination.pages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e-${i}`} className="px-1 text-gray-700 text-sm">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                        ${p === page ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white hover:bg-surface-800"}`}>
                      {p}
                    </button>
                  )
                )}

                <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">→</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
