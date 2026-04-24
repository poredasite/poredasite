import { useState, useEffect } from "react";
import { videoApi } from "../api";
import VideoCard from "./VideoCard";

export default function SidebarLinks() {
  const [data, setData] = useState(null);
  const [tab,  setTab]  = useState("trending");

  useEffect(() => {
    videoApi.getSidebar().then((res) => setData(res.data)).catch(() => {});
  }, []);

  const list = data?.[tab] || [];

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-surface-800 border border-white/5 rounded-xl p-0.5 w-fit">
        {[
          { key: "trending", label: "Trend" },
          { key: "recent",   label: "Yeni"  },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-xs font-semibold px-5 py-1.5 rounded-lg transition-all touch-manipulation ${
              tab === key ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton rounded-xl" style={{ aspectRatio: "16/9" }} />
              <div className="skeleton h-3.5 rounded w-3/4" />
              <div className="skeleton h-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {data && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5">
          {list.map((v) => <VideoCard key={v._id} video={v} />)}
        </div>
      )}
    </div>
  );
}
