import { useState, useEffect } from "react";
import { videoApi, categoryApi } from "../api";
import VideoCard from "../components/VideoCard";
import { VideoGridSkeleton } from "../components/Skeletons";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";
import SEOHead from "../components/SEOHead";
import { useAds } from "../context/AdsContext";
import { HiFire, HiClock } from "react-icons/hi";

// ── Category bar ─────────────────────────────────────────────────────────────
function CategoryBar({ activeCategory, onSelect }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryApi.getAll().then((res) => setCategories(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-5">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
          ${!activeCategory
            ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
            : "bg-surface-800 text-gray-400 border border-white/8 hover:border-brand-500/40 hover:text-white"}`}
      >
        Tümü
      </button>
      {loading && Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-20 rounded-full flex-shrink-0" />
      ))}
      {!loading && categories.map((cat) => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat._id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
            ${activeCategory === cat._id
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-surface-800 text-gray-400 border border-white/8 hover:border-brand-500/40 hover:text-white"}`}
        >
          {cat.name}
          {cat.videoCount > 0 && (
            <span className="ml-1.5 text-xs opacity-50">{cat.videoCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ sort, total, activeCategory }) {
  const isPopular = sort === "views";
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg
          ${isPopular ? "bg-brand-500/20 text-brand-400" : "bg-surface-700 text-gray-400"}`}>
          {isPopular
            ? <HiFire className="w-4 h-4" />
            : <HiClock className="w-4 h-4" />}
        </div>
        <div>
          <h1 className="font-display font-bold text-base sm:text-lg text-white leading-tight">
            {isPopular ? "En Popüler Videolar" : "Son Yüklenen Videolar"}
          </h1>
          {total != null && (
            <p className="text-gray-600 text-xs mt-0.5">
              {total} video{activeCategory ? " bu kategoride" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex gap-0.5 bg-surface-900 border border-white/5 rounded-lg p-0.5">
        {[
          { value: "createdAt", label: "Yeni", icon: HiClock },
          { value: "views",     label: "Popüler", icon: HiFire },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            aria-label={label}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all duration-200
              ${sort === value
                ? "bg-brand-500 text-white shadow-sm"
                : "text-gray-500 hover:text-white"}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ←
      </button>
      {getPageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="px-1 text-gray-700 text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
              ${p === page
                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
                : "text-gray-500 hover:text-white hover:bg-surface-800"}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-surface-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        →
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { isMobile } = useAds();
  const [videos, setVideos]           = useState([]);
  const [pagination, setPagination]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [page, setPage]               = useState(1);
  const [sort, setSort]               = useState("createdAt");
  const [activeCategory, setActiveCategory] = useState(null);

  const limit = isMobile ? 12 : 24;

  useEffect(() => { fetchVideos(); }, [page, sort, activeCategory, limit]);

  async function fetchVideos() {
    setLoading(true);
    setError(null);
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

  function handleCategorySelect(catId) {
    setActiveCategory(catId);
    setPage(1);
  }

  function handleSortChange(value) {
    setSort(value);
    setPage(1);
  }

  // Inject in-feed ads every 12 videos
  const gridItems = videos.reduce((acc, video, i) => {
    acc.push({ type: "video", video, key: video._id });
    if ((i + 1) % 12 === 0 && i !== videos.length - 1) {
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

        {/* Category filter bar */}
        <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

        {/* Section header + sort toggle — wrapped so sort changes don't re-mount children */}
        <div onClick={(e) => {
          const btn = e.target.closest("[data-sort]");
          if (btn) handleSortChange(btn.dataset.sort);
        }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg
                ${sort === "views" ? "bg-brand-500/20 text-brand-400" : "bg-surface-700 text-gray-400"}`}>
                {sort === "views" ? <HiFire className="w-4 h-4" /> : <HiClock className="w-4 h-4" />}
              </div>
              <div>
                <h1 className="font-display font-bold text-base sm:text-lg text-white leading-tight">
                  {sort === "views" ? "En Popüler Videolar" : "Son Yüklenen Videolar"}
                </h1>
                {pagination && (
                  <p className="text-gray-600 text-xs mt-0.5">
                    {pagination.total} video{activeCategory ? " bu kategoride" : ""}
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
                  data-sort={value}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all duration-200
                    ${sort === value
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-white"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && <VideoGridSkeleton count={limit} />}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mb-2">
              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Yüklenemedi: {error}</p>
            <button onClick={fetchVideos} className="btn-primary text-sm">Tekrar Dene</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mb-2">
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 animate-fade-in">
              {gridItems.map((item, idx) =>
                item.type === "ad"
                  ? <InFeedAd key={item.key} />
                  : <VideoCard key={item.key} video={item.video} priority={idx < 6} />
              )}
            </div>

            <Pagination
              page={page}
              totalPages={pagination?.pages ?? 1}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </>
        )}
      </div>
    </>
  );
}
