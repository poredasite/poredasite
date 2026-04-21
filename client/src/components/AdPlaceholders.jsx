import { useEffect, useRef, useState } from "react";
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

// ─── Top Banner ────────────────────────────────────────────────────
export function TopBannerAd() {
  const { getSlot } = useAds();
  const slot = getSlot("topBanner");
  if (!slot?.enabled) return null;

  const style = slotStyle(slot);
  return (
    <div className="flex justify-center mb-6" style={{ minHeight: slot.height ? `${slot.height}px` : 90 }}>
      {slot.code
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
      {slot.code
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

  return (
    <div className="col-span-1 my-1 overflow-hidden">
      <LazyAdSlot
        html={slot.code}
        style={{ width: "100%", maxWidth: "100%" }}
        minHeight={slot.height || 90}
        className="[&>*]:!max-w-full [&_img]:!max-w-full [&_img]:!h-auto"
      />
    </div>
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
export function BelowDescriptionAd() {
  const { getSlot } = useAds();
  const slot = getSlot("belowDescription");
  if (!slot?.enabled) return null;

  const style = slotStyle(slot);
  return (
    <div className="flex justify-center my-4" style={{ minHeight: slot.height || 90 }}>
      {slot.code
        ? <LazyAdSlot html={slot.code} style={style} minHeight={slot.height || 90} />
        : <Placeholder label="Açıklama Altı Reklam" style={style} />
      }
    </div>
  );
}

// ─── Instream Video (pre-roll) ─────────────────────────────────────
export function InstreamVideoAd({ onSkip }) {
  const { getSlot } = useAds();
  const slot = getSlot("instreamVideo");
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const adsManagerRef = useRef(null);
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!slot?.enabled) { onSkip?.(); return; }
    if (!slot?.vastUrl) return;

    let destroyed = false;

    function initIMA() {
      if (!window.google?.ima) { setTimeout(initIMA, 200); return; }
      if (destroyed) return;

      const adContainer = containerRef.current;
      const contentVideo = videoRef.current;
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
  }, [slot?.enabled, slot?.vastUrl]);

  useEffect(() => {
    if (!slot?.enabled) return;
    if (countdown <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, slot?.enabled]);

  if (!slot?.enabled) return null;

  const h = slot.height ? `${slot.height}px` : "360px";

  if (slot.vastUrl) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden mb-4 bg-black" style={{ height: h }}>
        <video ref={videoRef} style={{ display: "none" }} />
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
