import { useState, useEffect } from "react";
import { categoryApi } from "../api";
import { SidebarAd } from "./AdPlaceholders";

export default function CategorySidebar({ activeCategory, onSelect }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Mobile: horizontal chips */}
      <div className="lg:hidden w-full">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${!activeCategory ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-white/5"}`}
          >
            Tümü
          </button>
          {!loading && categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => onSelect(cat._id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                ${activeCategory === cat._id ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-400 border border-white/5"}`}
            >
              {cat.name}
            </button>
          ))}
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Desktop: left sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-48 xl:w-52 flex-shrink-0 gap-6">
        <div className="sticky top-20 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-3">
            Kategoriler
          </p>

          <button
            onClick={() => onSelect(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
              ${!activeCategory ? "bg-brand-500/10 text-brand-400 border border-brand-500/20" : "text-gray-500 hover:text-white hover:bg-surface-800"}`}
          >
            <span>Tüm Videolar</span>
          </button>

          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-9 rounded-lg" />
          ))}

          {!loading && categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => onSelect(cat._id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-left group
                ${activeCategory === cat._id ? "bg-brand-500/10 text-brand-400 border border-brand-500/20" : "text-gray-500 hover:text-white hover:bg-surface-800"}`}
            >
              <span className="truncate">{cat.icon} {cat.name}</span>
              {cat.videoCount > 0 && (
                <span className={`text-xs font-mono ml-2 flex-shrink-0
                  ${activeCategory === cat._id ? "text-brand-500/60" : "text-gray-700 group-hover:text-gray-500"}`}>
                  {cat.videoCount}
                </span>
              )}
            </button>
          ))}

          {!loading && categories.length === 0 && (
            <p className="text-gray-700 text-xs px-3 py-2">Henüz kategori yok</p>
          )}

          <div className="pt-4 mt-2 border-t border-white/5">
            <SidebarAd />
            {/* Fallback placeholder if ad disabled */}
          </div>
        </div>
      </aside>
    </>
  );
}
