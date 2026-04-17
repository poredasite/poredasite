import { useState, useEffect } from "react";
import { videoApi } from "../api";
import VideoCard from "../components/VideoCard";
import CategorySidebar from "../components/CategorySidebar";
import { VideoGridSkeleton } from "../components/Skeletons";
import { TopBannerAd, InFeedAd, SidebarAd } from "../components/AdPlaceholders";
import SEOHead from "../components/SEOHead";
import { useAds } from "../context/AdsContext";

export default function Home() {
  const { isMobile, getSlot } = useAds();
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [activeCategory, setActiveCategory] = useState(null);

  const limit = isMobile ? 10 : 12;
  const sidebarSlot = getSlot("sidebar");

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
    if ((i + 1) % 8 === 0 && i !== videos.length - 1) acc.push({ type: "ad", key: `ad-${i}` });
    return acc;
  }, []);

  // Numbered pagination pages
  function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  return (
    <>
      <SEOHead title="Home" description="Porno izle Türk ❤️ Porn sex video ☘️ Poreda inanılmaz Amatör porna ve sikiş filmleri seyret ⭐ altyazılı Full HD pornosu ⭐ endişe verici Türkçe dublaj pornolar." url="/" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <TopBannerAd />
        <div className="flex flex-col lg:flex-row gap-6 xl:gap-7">

          {/* Left: categories */}
          <CategorySidebar activeCategory={activeCategory} onSelect={handleCategorySelect} />

          {/* Center: videos */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h1 className="font-display font-bold text-xl text-white tracking-tight">
                  {sort === "views" ? "En Popüler" : "Son Videolar"}
                </h1>
                {pagination && (
                  <p className="text-gray-600 text-sm mt-0.5">
                    {pagination.total} video{activeCategory ? " bu kategoride" : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex gap-0.5 bg-surface-900 border border-white/5 rounded-lg p-0.5">
                  {[{ value: "createdAt", label: "En Yeni" }, { value: "views", label: "Popüler" }].map((opt) => (
                    <button key={opt.value} onClick={() => { setSort(opt.value); setPage(1); }}
                      className={`text-sm px-3 py-1.5 rounded-md font-medium transition-all
                        ${sort === opt.value ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && <VideoGridSkeleton count={limit} />}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <p className="text-gray-500">Yüklenemedi: {error}</p>
                <button onClick={fetchVideos} className="btn-primary">Tekrar Dene</button>
              </div>
            )}

            {!loading && !error && videos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <div className="w-14 h-14 bg-surface-800 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white font-display font-semibold">Video bulunamadı</p>
                <p className="text-gray-600 text-sm">{activeCategory ? "Bu kategoride henüz video yok." : "Henüz video yüklenmedi."}</p>
                {activeCategory && <button onClick={() => handleCategorySelect(null)} className="btn-ghost text-sm">Tüm videolar</button>}
              </div>
            )}

            {!loading && !error && videos.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
                  {gridItems.map((item, idx) =>
                    item.type === "ad"
                      ? <InFeedAd key={item.key} />
                      : <VideoCard key={item.key} video={item.video} priority={idx < 4} />
                  )}
                </div>

                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-10">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ←
                    </button>

                    {getPageNumbers(page, pagination.pages).map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-gray-700 text-sm">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                            ${p === page
                              ? "bg-brand-500 text-white"
                              : "text-gray-500 hover:text-white hover:bg-surface-800"}`}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <button
                      onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={page === pagination.pages}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: sidebar ad — only on xl+ and when enabled */}
          {sidebarSlot?.enabled && (
            <aside className="hidden xl:block w-56 flex-shrink-0">
              <div className="sticky top-20">
                <SidebarAd />
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
