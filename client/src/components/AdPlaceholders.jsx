import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useAds } from "../context/AdsContext";

// ─── Core: inject HTML + re-execute scripts ────────────────────────
function AdSlot({ html, style, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !html) return;
    const el = ref.current;
    el.innerHTML = "";
    try {
      el.appendChild(document.createRange().createContextualFragment(html));
      el.querySelectorAll("script").forEach((old) => {
        const s = document.createElement("script");
        [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
    } catch {}
  }, [html]);

  return <div ref={ref} style={style} className={className} />;
}

// Lazy ad — only mounts when visible
function LazyAdSlot({ html, style, className, minHeight = 90 }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  return (
    <div ref={ref} style={{ minHeight, ...style }} className={className}>
      {inView && html && <AdSlot html={html} style={{ width: "100%", height: "100%" }} />}
    </div>
  );
}

function slotStyle(slot) {
  if (!slot) return {};
  const w = slot.width ? (String(slot.width).includes("%") ? slot.width : `${slot.width}px`) : "100%";
  const h = slot.height ? (String(slot.height).includes("%") ? slot.height : `${slot.height}px`) : undefined;
  return { width: w, ...(h ? { height: h } : {}) };
}

function Placeholder({ label, style }) {
  return (
    <div
      className="ad-placeholder rounded-xl flex items-center justify-center"
      style={{ minHeight: 90, ...style }}
    >
      <span className="text-surface-600 text-[10px] tracking-widest uppercase font-mono">{label}</span>
    </div>
  );
}

// ─── Image Banner (resim + link) ───────────────────────────────────
function ImageBannerSlot({ slot, style }) {
  return (
    <a href={slot.linkUrl || "#"} target="_blank" rel="noopener noreferrer" style={style} className="block overflow-hidden">
      <img src={slot.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </a>
  );
}

// ─── Top Banner ────────────────────────────────────────────────────
export function TopBannerAd({ slotKey = "topBanner" }) {
  const { getSlot, adsLoaded } = useAds();
  const slot = getSlot(slotKey);
  const minH = slot?.height ? `${slot.height}px` : "90px";

  // Reserve exact space while ads API loads to prevent CLS (only first slot)
  if (!adsLoaded) return slotKey === "topBanner" ? <div style={{ height: minH }} className="mb-6" /> : null;
  if (!slot?.enabled) return null;

  const style = slotStyle(slot);
  return (
    <div className="flex justify-center mb-6" style={{ height: minH, overflow: "hidden" }}>
      {slot.imageUrl
        ? <ImageBannerSlot slot={slot} style={style} />
        : slot.code
          ? <LazyAdSlot html={slot.code} style={style} minHeight={slot.height || 90} />
          : <Placeholder label="Banner Reklam" style={style} />
      }
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────
export function SidebarAd() {
  const { getSlot } = useAds();
  const slot = getSlot("sidebar");
  if (!slot?.enabled) return null;

  const style = slotStyle(slot);
  return (
    <div className="sticky top-24 mb-5" style={{ minHeight: slot.height || 250 }}>
      {slot.imageUrl
        ? <ImageBannerSlot slot={slot} style={{ ...style, minHeight: slot.height || 250 }} />
        : slot.code
          ? <LazyAdSlot html={slot.code} style={style} minHeight={slot.height || 250} />
          : <Placeholder label="Kenar Reklam" style={{ ...style, minHeight: 250 }} />
      }
    </div>
  );
}

// ─── In-Feed ──────────────────────────────────────────────────────
export function InFeedAd() {
  const { getSlot } = useAds();
  const slot = getSlot("inFeed");
  if (!slot?.enabled) return null;

  const h = slot.height || 300;
  return (
    <div className="col-span-1 my-1">
      <div style={{ width: "100%", maxWidth: 320, height: h, overflow: "hidden" }}>
        <LazyAdSlot html={slot.code} style={{ width: 320, height: h }} minHeight={h} />
      </div>
    </div>
  );
}

// ─── Native Feed Ad ───────────────────────────────────────────────
// Cycles through enabled nativeFeed1-4 variants in order (1→2→3→4→1…)
const NATIVE_KEYS = ["nativeFeed1", "nativeFeed2", "nativeFeed3", "nativeFeed4"];
let nativeFeedCounter = 0;

export function NativeFeedAd() {
  const { getSlot } = useAds();

  const candidates = NATIVE_KEYS
    .map(k => getSlot(k))
    .filter(s => s?.enabled && (s.imageUrl || s.title));

  // Assign a sequential index on first render — stable across re-renders
  const idxRef = useRef(null);
  if (idxRef.current === null && candidates.length > 0) {
    idxRef.current = nativeFeedCounter++;
  }

  if (candidates.length === 0) return null;

  const slot = candidates[idxRef.current % candidates.length];

  return (
    <a
      href={slot.linkUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-2 cursor-pointer"
    >
      {/* Thumbnail — same structure as VideoCard */}
      <div className="relative rounded-xl overflow-hidden bg-neutral-900" style={{ aspectRatio: "16/9" }}>
        <div className="absolute inset-0">
          {slot.imageUrl ? (
            <img
              src={slot.imageUrl}
              alt={slot.title || ""}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-800" />
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-11 h-11 rounded-full bg-brand-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-brand-500/30">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      </div>

      {/* Text — same padding as VideoCard */}
      <div className="px-1">
        {slot.title && (
          <p className="text-neutral-200 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {slot.title}
          </p>
        )}
        {slot.description && (
          <p className="text-neutral-500 text-[11px] mt-1 line-clamp-2">
            {slot.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ─── Sticky Banner ────────────────────────────────────────────────
// Positioned above mobile bottom nav (bottom-16 on mobile, bottom-0 on desktop)
export function StickyBannerAd() {
  const [closed, setClosed] = useState(false);
  const { getSlot } = useAds();
  const slot = getSlot("stickyBanner");

  if (closed || !slot?.enabled || !slot?.code) return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-50 flex justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative mx-auto" style={slotStyle(slot)}>
        <button
          onClick={() => setClosed(true)}
          className="absolute -top-6 right-0 bg-surface-800 text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded-t-md transition-colors"
          aria-label="Reklamı kapat"
        >
          ✕
        </button>
        <AdSlot html={slot.code} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

// ─── Popunder (fires once per session on first click) ─────────────
export function PopunderAd() {
  const { getSlot } = useAds();
  const slot = getSlot("popunder");
  const fired = useRef(false);

  useEffect(() => {
    if (!slot?.enabled || !slot?.code) return;
    if (sessionStorage.getItem("pu_fired")) return;

    function fire() {
      if (fired.current) return;
      fired.current = true;
      sessionStorage.setItem("pu_fired", "1");
      const div = document.createElement("div");
      div.style.display = "none";
      document.body.appendChild(div);
      try {
        div.appendChild(document.createRange().createContextualFragment(slot.code));
        div.querySelectorAll("script").forEach((old) => {
          const s = document.createElement("script");
          [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
          s.textContent = old.textContent;
          old.replaceWith(s);
        });
      } catch {}
      document.removeEventListener("click", fire);
    }

    document.addEventListener("click", fire, { once: true });
    return () => document.removeEventListener("click", fire);
  }, [slot?.enabled, slot?.code]);

  return null;
}

// ─── Instant Message / Interstitial ───────────────────────────────
export function InstantMessageAd() {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const { getSlot } = useAds();
  const slot = getSlot("instantMessage");

  useEffect(() => {
    if (!slot?.enabled || !slot?.code) return;
    if (sessionStorage.getItem("im_shown")) return;
    const t = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem("im_shown", "1");
    }, 3000);
    return () => clearTimeout(t);
  }, [slot?.enabled, slot?.code]);

  useEffect(() => {
    if (!show || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [show, countdown]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative max-w-full">
        <AdSlot html={slot.code} style={slotStyle(slot)} />
        <button
          onClick={() => countdown <= 0 && setShow(false)}
          disabled={countdown > 0}
          className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            countdown > 0
              ? "bg-surface-700 text-gray-500 cursor-not-allowed"
              : "bg-brand-500 hover:bg-brand-400 text-white cursor-pointer"
          }`}
          aria-label={countdown > 0 ? `${countdown} saniye` : "Kapat"}
        >
          {countdown > 0 ? countdown : "✕"}
        </button>
      </div>
    </div>
  );
}

// ─── Below Description ────────────────────────────────────────────
export function BelowDescriptionAd({ slotKey = "belowDescription" }) {
  const { getSlot } = useAds();
  const slot = getSlot(slotKey);
  if (!slot?.enabled) return null;

  const style = slotStyle(slot);
  return (
    <div className="flex justify-center my-4" style={{ minHeight: slot.height || 90 }}>
      {slot.imageUrl
        ? <ImageBannerSlot slot={slot} style={style} />
        : slot.code
          ? <LazyAdSlot html={slot.code} style={style} minHeight={slot.height || 90} />
          : <Placeholder label="Açıklama Altı Reklam" style={style} />
      }
    </div>
  );
}

// ─── Instream Video (pre-roll) ─────────────────────────────────────
const SKIP_AFTER_SECONDS = 8;

export function InstreamVideoAd({ onSkip }) {
  const { getSlot } = useAds();
  const slot = getSlot("instreamVideo");
  const containerRef = useRef(null);
  const imaVideoRef = useRef(null);
  const adVideoRef = useRef(null);
  const adsManagerRef = useRef(null);
  // For VAST/HTML code modes (wall-clock countdown, starts from mount)
  const [countdown, setCountdown] = useState(SKIP_AFTER_SECONDS);
  const [canSkip, setCanSkip] = useState(false);
  // For custom video URL mode
  const [adStarted, setAdStarted] = useState(false);
  const [adMuted, setAdMuted] = useState(true);
  const [adCurrentTime, setAdCurrentTime] = useState(0);

  // VAST IMA mode
  useEffect(() => {
    if (!slot?.enabled || slot?.videoUrl) return;
    if (!slot?.vastUrl) return;

    let destroyed = false;

    function initIMA() {
      if (!window.google?.ima) { setTimeout(initIMA, 200); return; }
      if (destroyed) return;

      const adContainer = containerRef.current;
      const contentVideo = imaVideoRef.current;
      if (!adContainer || !contentVideo) return;

      const adDisplayContainer = new window.google.ima.AdDisplayContainer(adContainer, contentVideo);
      adDisplayContainer.initialize();

      const adsLoader = new window.google.ima.AdsLoader(adDisplayContainer);

      adsLoader.addEventListener(
        window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (e) => {
          if (destroyed) return;
          const mgr = e.getAdsManager(contentVideo);
          adsManagerRef.current = mgr;
          mgr.addEventListener(window.google.ima.AdEvent.Type.COMPLETE, () => onSkip?.());
          mgr.addEventListener(window.google.ima.AdEvent.Type.SKIPPED, () => onSkip?.());
          mgr.addEventListener(window.google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => onSkip?.());
          try {
            const h = adContainer.offsetHeight || parseInt(slot.height) || 360;
            mgr.init(adContainer.offsetWidth, h, window.google.ima.ViewMode.NORMAL);
            mgr.start();
          } catch { onSkip?.(); }
        }
      );

      adsLoader.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, () => onSkip?.());

      const req = new window.google.ima.AdsRequest();
      req.adTagUrl = slot.vastUrl;
      req.linearAdSlotWidth = adContainer.offsetWidth;
      req.linearAdSlotHeight = adContainer.offsetHeight || parseInt(slot.height) || 360;
      req.nonLinearAdSlotWidth = adContainer.offsetWidth;
      req.nonLinearAdSlotHeight = 150;
      adsLoader.requestAds(req);
    }

    initIMA();
    return () => { destroyed = true; adsManagerRef.current?.destroy(); };
  }, [slot?.enabled, slot?.vastUrl, slot?.videoUrl]);

  // Wall-clock countdown for VAST/HTML code modes only
  useEffect(() => {
    if (!slot?.enabled || slot?.videoUrl) return;
    if (countdown <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, slot?.enabled, slot?.videoUrl]);

  if (!slot?.enabled) return null;

  // ─── Mode 1: Custom MP4 video URL ──────────────────────────────
  if (slot.videoUrl) {
    const skipCountdown = Math.max(0, SKIP_AFTER_SECONDS - Math.floor(adCurrentTime));
    const videoCanSkip = adCurrentTime >= SKIP_AFTER_SECONDS;

    function handleVideoClick(e) {
      e.stopPropagation();
      const v = adVideoRef.current;
      if (!v) return;
      if (!adStarted) {
        v.muted = false;
        setAdMuted(false);
        v.play().catch(() => {});
      } else if (slot.linkUrl) {
        window.open(slot.linkUrl, "_blank", "noopener,noreferrer");
      }
    }

    function toggleMute(e) {
      e.stopPropagation();
      const v = adVideoRef.current;
      if (!v) return;
      v.muted = !v.muted;
      setAdMuted(v.muted);
    }

    return (
      <div className="relative w-full aspect-video sm:rounded-2xl overflow-hidden mb-4 bg-black">
        <video
          ref={adVideoRef}
          src={slot.videoUrl}
          className="w-full h-full object-contain"
          style={{ cursor: slot.linkUrl && adStarted ? "pointer" : "default" }}
          autoPlay
          muted
          playsInline
          onPlay={() => setAdStarted(true)}
          onTimeUpdate={() => setAdCurrentTime(adVideoRef.current?.currentTime || 0)}
          onEnded={() => onSkip?.()}
          onClick={handleVideoClick}
        />

        {/* Play overlay when autoplay blocked */}
        {!adStarted && (
          <button
            onClick={handleVideoClick}
            className="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <div className="w-16 h-16 bg-brand-500/90 hover:bg-brand-400 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-[0_0_40px_rgba(255,107,0,0.4)]">
              <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </button>
        )}

        {/* Top-left: Ad label + mute toggle */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <span className="bg-black/60 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider">Reklam</span>
          {adStarted && (
            <button
              onClick={toggleMute}
              className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded transition-colors"
              title={adMuted ? "Sesi aç" : "Sesi kapat"}
            >
              {adMuted ? "🔇" : "🔊"}
            </button>
          )}
        </div>

        {/* Top-right: Visit link */}
        {adStarted && slot.linkUrl && (
          <button
            onClick={() => window.open(slot.linkUrl, "_blank", "noopener,noreferrer")}
            className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded transition-colors"
          >
            Siteyi Ziyaret Et ↗
          </button>
        )}

        {/* Bottom-right: Skip countdown / button */}
        <div className="absolute bottom-4 right-4 z-10">
          {!videoCanSkip
            ? <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg font-mono">
                {!adStarted ? "Reklam yükleniyor..." : `${skipCountdown}s sonra geç`}
              </span>
            : <button
                onClick={onSkip}
                className="bg-surface-700 hover:bg-surface-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                Reklamı Geç →
              </button>
          }
        </div>
      </div>
    );
  }

  // ─── Mode 2: VAST URL (Google IMA) ─────────────────────────────
  const h = slot.height ? `${slot.height}px` : "360px";

  if (slot.vastUrl) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden mb-4 bg-black" style={{ height: h }}>
        <video ref={imaVideoRef} style={{ display: "none" }} />
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="bg-black/60 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider">Reklam</span>
        </div>
        <div className="absolute bottom-4 right-4 z-10">
          {!canSkip
            ? <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg font-mono">{countdown}s sonra geç</span>
            : <button onClick={() => { adsManagerRef.current?.skip(); onSkip?.(); }}
                className="bg-surface-700 hover:bg-surface-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                Reklamı Geç →
              </button>
          }
        </div>
      </div>
    );
  }

  // ─── Mode 3: HTML code ──────────────────────────────────────────
  const style = slotStyle(slot);
  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-4 bg-black flex items-center justify-center" style={{ minHeight: style.height || "300px" }}>
      {slot.code
        ? <AdSlot html={slot.code} style={{ width: "100%", height: "100%" }} />
        : <div className="w-full h-full flex flex-col items-center justify-center gap-2 min-h-[200px]">
            <span className="text-surface-500 text-xs tracking-widest uppercase font-mono">Video Reklam</span>
          </div>
      }
      <div className="absolute top-3 left-3">
        <span className="bg-black/60 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider">Reklam</span>
      </div>
      <div className="absolute bottom-4 right-4">
        {!canSkip
          ? <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg font-mono">{countdown}s sonra geç</span>
          : <button onClick={onSkip} className="bg-surface-700 hover:bg-surface-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Reklamı Geç →
            </button>
        }
      </div>
    </div>
  );
}

// ─── Entry Popup (video sayfasına girişte küçük popup) ─────────────
export function EntryPopupAd() {
  const { getSlot } = useAds();
  const slot = getSlot("entryPopup");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!slot?.enabled || !slot?.message) return;
    if (sessionStorage.getItem("ep_shown")) return;
    const t = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem("ep_shown", "1");
    }, 1500);
    return () => clearTimeout(t);
  }, [slot?.enabled, slot?.message]);

  if (!show) return null;

  function handleYes() {
    if (slot.linkUrl) window.open(slot.linkUrl, "_blank", "noopener,noreferrer");
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={() => setShow(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-surface-800 border border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setShow(false)}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
          aria-label="Kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-white text-sm leading-relaxed pr-4 mb-5">{slot.message}</p>
        <div className="flex gap-3">
          <button
            onClick={handleYes}
            className="flex-1 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Evet
          </button>
          <button
            onClick={() => setShow(false)}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-gray-300 text-sm py-2.5 rounded-xl transition-colors"
          >
            Hayır
          </button>
        </div>
      </div>
    </div>
  );
}
