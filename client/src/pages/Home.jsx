import { useState, useEffect } from "react";
import { videoApi } from "../api";
import VideoCard from "../components/VideoCard";
import CategorySidebar from "../components/CategorySidebar";
import { VideoGridSkeleton } from "../components/Skeletons";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";
import SEOHead from "../components/SEOHead";

const SORT_OPTIONS = [
  { value: "createdAt", label: "En Yeni" },
  { value: "views", label: "En Çok İzlenen" },
];

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => { fetchVideos(); }, [page, sort, activeCategory]);

  async function fetchVideos() {
    setLoading(true); setError(null);
    try {
      const params = { page, limit: 12, sort };
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
    if ((i + 1) % 8 === 0 && i !== videos.length - 1) acc.push({ type: "ad", key: `ad-${i}` });
    return acc;
  }, []);

  return (
    <>
      <SEOHead title="Home" description="Porno izle Türk ❤️ Porn sex video ☘️ Poreda inanılmaz Amatör porna ve sikiş filmleri seyret ⭐ altyazılı Full HD pornosu ⭐ endişe verici Türkçe dublaj pornolar." url="/" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <TopBannerAd />
        <div className="flex flex-col lg:flex-row gap-6 xl:gap-8">

          {/* Left Sidebar */}
          <CategorySidebar activeCategory={activeCategory} onSelect={handleCategorySelect} />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h1 className="font-display font-bold text-2xl text-white tracking-tight">
                  {sort === "views" ? "🔥 En Popüler" : "✨ En Yeni Videolar"}
                </h1>
                {pagination && (
                  <p className="text-gray-500 text-sm mt-0.5">
                    {pagination.total} video
                    {activeCategory ? " bu kategoride" : " mevcut"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-gray-500 text-sm hidden sm:block">Sırala:</span>
                <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => { setSort(opt.value); setPage(1); }}
                      className={`text-sm px-3 py-1.5 rounded-md font-medium transition-all duration-200
                        ${sort === opt.value ? "bg-brand-500 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && <VideoGridSkeleton count={9} />}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <p className="text-gray-400">Yüklenemedi: {error}</p>
                <button onClick={fetchVideos} className="btn-primary">Tekrar Dene</button>
              </div>
            )}

            {!loading && !error && videos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-white font-display font-semibold text-lg">Video bulunamadı</h2>
                <p className="text-gray-500 text-sm">{activeCategory ? "Bu kategoride henüz video yok." : "Yönetim panelinden ilk videonu yükle."}</p>
                {activeCategory && <button onClick={() => handleCategorySelect(null)} className="btn-ghost text-sm">Tüm videoları gör</button>}
              </div>
            )}

            {!loading && !error && videos.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 animate-fade-in">
                  {gridItems.map((item, idx) =>
                    item.type === "ad"
                      ? <InFeedAd key={item.key} />
                      : <VideoCard key={item.key} video={item.video} priority={idx < 3} />
                  )}
                </div>

                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost disabled:opacity-30">← Önceki</button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(7, pagination.pages) }, (_, i) => {
                        const total = pagination.pages;
                        let pageNum;
                        if (total <= 7) pageNum = i + 1;
                        else if (page <= 4) pageNum = i + 1;
                        else if (page >= total - 3) pageNum = total - 6 + i;
                        else pageNum = page - 3 + i;
                        return (
                          <button key={pageNum} onClick={() => setPage(pageNum)}
                            className={`w-9 h-9 rounded-lg text-sm font-display font-medium transition-all
                              ${pageNum === page ? "bg-brand-500 text-white" : "text-gray-400 hover:text-white hover:bg-surface-700"}`}>
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-ghost disabled:opacity-30">Sonraki →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
