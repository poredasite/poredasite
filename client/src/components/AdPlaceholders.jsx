// ─── Ad Placeholder Components ───────────────────────────────────
// These are UI placeholder blocks. Replace with real ad network code in production.

// Top banner ad — full width, shown at top of homepage
export function TopBannerAd() {
  return (
    <div
      className="ad-placeholder w-full h-20 sm:h-24 mb-6 rounded-xl"
      aria-label="Advertisement"
      role="complementary"
    >
      <div className="flex flex-col items-center gap-1 pointer-events-none">
        <span className="text-surface-600 text-[10px] tracking-[0.2em] uppercase font-mono">
          Advertisement
        </span>
        <span className="text-surface-700 text-[9px] tracking-widest">
          728 × 90 — Leaderboard
        </span>
      </div>
    </div>
  );
}

// Sidebar ad — displayed next to the video player
export function SidebarAd() {
  return (
    <div
      className="ad-placeholder w-full h-64 rounded-xl sticky top-24"
      aria-label="Advertisement"
      role="complementary"
    >
      <div className="flex flex-col items-center gap-1 pointer-events-none">
        <span className="text-surface-600 text-[10px] tracking-[0.2em] uppercase font-mono">
          Advertisement
        </span>
        <span className="text-surface-700 text-[9px] tracking-widest">
          300 × 250 — Medium Rectangle
        </span>
      </div>
    </div>
  );
}

// In-feed ad — appears between video grid items
export function InFeedAd() {
  return (
    <div
      className="ad-placeholder col-span-1 sm:col-span-2 h-28 rounded-xl"
      aria-label="Advertisement"
      role="complementary"
    >
      <div className="flex flex-col items-center gap-1 pointer-events-none">
        <span className="text-surface-600 text-[10px] tracking-[0.2em] uppercase font-mono">
          Sponsored
        </span>
        <span className="text-surface-700 text-[9px] tracking-widest">
          In-Feed — Native Ad Unit
        </span>
      </div>
    </div>
  );
}

// Pre-roll / mid-roll placeholder (video page, above player)
export function PreRollAd({ onSkip }) {
  return (
    <div className="relative w-full aspect-video bg-surface-800 rounded-2xl flex items-center justify-center overflow-hidden mb-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-surface-500 text-xs tracking-widest uppercase font-mono">
          Ad · Pre-Roll
        </span>
        <span className="text-surface-600 text-[10px]">Video Ad Placeholder</span>
      </div>
      {onSkip && (
        <button
          onClick={onSkip}
          className="absolute bottom-4 right-4 bg-surface-700 hover:bg-surface-600
                     text-white text-xs px-3 py-1.5 rounded transition-colors font-mono"
        >
          Skip Ad →
        </button>
      )}
    </div>
  );
}
