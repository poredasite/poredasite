import { useState, useEffect } from "react";
import { categoryApi } from "../api";

export default function CategorySidebar({ activeCategory, onSelect }) {
  const [categories, setKategoriler] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryApi.getAll().then(res => setKategoriler(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* ── Mobile: horizontal scrollable chips ─────────────────── */}
      <div className="lg:hidden w-full">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${!activeCategory ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-surface-700 active:bg-surface-700"}`}
          >
            🎬 Tümü
          </button>
          {!loading && categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => onSelect(cat._id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                ${activeCategory === cat._id ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-surface-700 active:bg-surface-700"}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-24 rounded-full flex-shrink-0" />
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
