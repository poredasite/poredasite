import { useEffect, useRef } from "react";
import { useAds } from "../context/AdsContext";

// Executes <script> tags inside injected HTML (needed for ad networks)
function AdSlot({ html, className, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    container.innerHTML = "";
    const wrapper = document.createRange().createContextualFragment(html);
    container.appendChild(wrapper);
    // Re-execute any script tags
    container.querySelectorAll("script").forEach((oldScript) => {
      const s = document.createElement("script");
      [...oldScript.attributes].forEach(a => s.setAttribute(a.name, a.value));
      s.textContent = oldScript.textContent;
      oldScript.replaceWith(s);
    });
  }, [html]);

  return <div ref={ref} className={className} />;
}

function Placeholder({ label, size }) {
  return (
    <div className="ad-placeholder w-full h-full flex items-center justify-center rounded-xl" aria-label="Advertisement" role="complementary">
      <div className="flex flex-col items-center gap-1 pointer-events-none">
        <span className="text-surface-600 text-[10px] tracking-[0.2em] uppercase font-mono">{label}</span>
        <span className="text-surface-700 text-[9px] tracking-widest">{size}</span>
      </div>
    </div>
  );
}

export function TopBannerAd() {
  const { ads } = useAds();
  const slot = ads?.topBanner;

  if (!slot?.enabled) return null;

  return slot.code
    ? <AdSlot html={slot.code} className="w-full mb-6" />
    : <div className="w-full h-20 sm:h-24 mb-6"><Placeholder label="Advertisement" size="728 × 90 — Leaderboard" /></div>;
}

export function SidebarAd() {
  const { ads } = useAds();
  const slot = ads?.sidebar;

  if (!slot?.enabled) return null;

  return slot.code
    ? <AdSlot html={slot.code} className="w-full sticky top-24 mb-5" />
    : <div className="w-full h-64 sticky top-24 mb-5"><Placeholder label="Advertisement" size="300 × 250 — Medium Rectangle" /></div>;
}

export function InFeedAd() {
  const { ads } = useAds();
  const slot = ads?.inFeed;

  if (!slot?.enabled) return null;

  return slot.code
    ? <AdSlot html={slot.code} className="col-span-1 sm:col-span-2" />
    : <div className="col-span-1 sm:col-span-2 h-28"><Placeholder label="Sponsored" size="In-Feed — Native Ad Unit" /></div>;
}

export function PreRollAd({ onSkip }) {
  return (
    <div className="relative w-full aspect-video bg-surface-800 rounded-2xl flex items-center justify-center overflow-hidden mb-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-surface-500 text-xs tracking-widest uppercase font-mono">Ad · Pre-Roll</span>
        <span className="text-surface-600 text-[10px]">Video Ad Placeholder</span>
      </div>
      {onSkip && (
        <button onClick={onSkip} className="absolute bottom-4 right-4 bg-surface-700 hover:bg-surface-600 text-white text-xs px-3 py-1.5 rounded transition-colors font-mono">
          Reklamı Geç →
        </button>
      )}
    </div>
  );
}
