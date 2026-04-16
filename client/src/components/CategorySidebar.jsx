import { useState, useEffect } from "react";
import { categoryApi } from "../api";

export default function CategorySidebar({ activeCategory, onSelect }) {
  const [categories, setKategoriler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    categoryApi.getAll().then(res => setKategoriler(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeLabel = activeCategory
    ? categories.find(c => c._id === activeCategory)?.name || "Kategori"
    : "Tüm Videolar";

  const activeIcon = activeCategory
    ? categories.find(c => c._id === activeCategory)?.icon || "🎬"
    : "🎬";

  function handleSelect(id) {
    onSelect(id);
    setMobileOpen(false);
  }

  return (
    <>
      {/* ── Mobile: horizontal scrollable chips ─────────────────── */}
      <div className="lg:hidden w-full mb-4">
        {/* Toggle button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-surface-800 border border-surface-700
                     rounded-xl text-sm font-medium text-white mb-2"
        >
          <span>{activeIcon}</span>
          <span className="flex-1 text-left">{activeLabel}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${mobileOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {mobileOpen && (
          <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden animate-fade-in">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left
                ${!activeCategory ? "bg-brand-500/15 text-brand-400" : "text-gray-300 hover:bg-surface-700"}`}
            >
              <span>🎬</span>
              <span className="flex-1">Tüm Videolar</span>
            </button>

            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-11 mx-3 my-1 rounded-lg" />
            ))}

            {!loading && categories.map(cat => (
              <button
                key={cat._id}
                onClick={() => handleSelect(cat._id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left
                  ${activeCategory === cat._id ? "bg-brand-500/15 text-brand-400" : "text-gray-300 hover:bg-surface-700"}`}
              >
                <span>{cat.icon}</span>
                <span className="flex-1">{cat.name}</span>
                {cat.videoCount > 0 && (
                  <span className="text-xs bg-surface-600 text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                    {cat.videoCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Horizontal scroll chips (always visible) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-2">
          <button
            onClick={() => handleSelect(null)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${!activeCategory ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-surface-700"}`}
          >
            🎬 All
          </button>
          {!loading && categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => handleSelect(cat._id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                ${activeCategory === cat._id ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-surface-700"}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop: left sidebar ────────────────────────────────── */}
      <aside className="hidden lg:block w-56 xl:w-64 flex-shrink-0">
        <div className="sticky top-24 space-y-1">
          <p className="text-xs font-display font-semibold text-gray-500 uppercase tracking-widest px-3 mb-3">
            Kategoriler
          </p>

          <button
            onClick={() => onSelect(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left
              ${!activeCategory ? "bg-brand-500/15 text-brand-400 border border-brand-500/25" : "text-gray-400 hover:text-white hover:bg-surface-800"}`}
          >
            <span className="text-base">🎬</span>
            <span className="flex-1">Tüm Videolar</span>
          </button>

          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-xl" />
          ))}

          {!loading && categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => onSelect(cat._id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left group
                ${activeCategory === cat._id ? "bg-brand-500/15 text-brand-400 border border-brand-500/25" : "text-gray-400 hover:text-white hover:bg-surface-800"}`}
            >
              <span className="text-base">{cat.icon}</span>
              <span className="flex-1 truncate">{cat.name}</span>
              {cat.videoCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono
                  ${activeCategory === cat._id ? "bg-brand-500/20 text-brand-400" : "bg-surface-700 text-gray-600 group-hover:text-gray-400"}`}>
                  {cat.videoCount}
                </span>
              )}
            </button>
          ))}

          {!loading && categories.length === 0 && (
            <p className="text-gray-600 text-xs px-3 py-2">Henüz kategori yok</p>
          )}

          <div className="pt-4 mt-2 border-t border-surface-700/40">
            <div className="ad-placeholder h-48 w-full rounded-xl" aria-label="Advertisement">
              <div className="flex flex-col items-center gap-1 pointer-events-none">
                <span className="text-surface-600 text-[10px] tracking-[0.2em] uppercase font-mono">Ad</span>
                <span className="text-surface-700 text-[9px]">160 × 600</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
