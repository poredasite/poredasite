import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { videoApi } from "../api";

function fmt(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function dur(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function MiniCard({ video }) {
  const d = dur(video.duration);
  return (
    <Link
      to={`/video/${video.slug || video._id}`}
      className="flex gap-3 group hover:bg-surface-700/50 rounded-xl p-1.5 -mx-1.5 transition-colors"
    >
      <div
        className="relative flex-shrink-0 w-[100px] rounded-lg overflow-hidden bg-surface-800"
        style={{ aspectRatio: "16/9" }}
      >
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {d && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 py-0.5 rounded">
            {d}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-white text-xs font-medium leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {video.title}
        </p>
        <p className="text-gray-600 text-[11px] mt-1">{fmt(video.displayViews ?? video.views)} izlenme</p>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton w-[100px] rounded-lg flex-shrink-0" style={{ aspectRatio: "16/9" }} />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SidebarLinks() {
  const [data, setData] = useState(null);
  const [tab,  setTab]  = useState("trending");

  useEffect(() => {
    videoApi.getSidebar().then((res) => setData(res.data)).catch(() => {});
  }, []);

  const list = data?.[tab] || [];

  return (
    <div className="bg-surface-900 border border-white/5 rounded-xl p-4">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-surface-800 rounded-lg p-0.5">
        {[
          { key: "trending", label: "Trend" },
          { key: "recent",   label: "Yeni"  },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all touch-manipulation ${
              tab === key ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!data  && <SkeletonList />}
      {data   && <div className="space-y-1">{list.map((v) => <MiniCard key={v._id} video={v} />)}</div>}
    </div>
  );
}
