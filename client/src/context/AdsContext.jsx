import { createContext, useContext, useEffect, useState } from "react";
import { adsApi } from "../api";

const AdsContext = createContext(null);

function makeSlot() {
  return {
    desktop: { enabled: false, code: "", vastUrl: "", imageUrl: "", linkUrl: "", videoUrl: "", title: "", description: "", width: "", height: "" },
    mobile:  { enabled: false, code: "", vastUrl: "", imageUrl: "", linkUrl: "", videoUrl: "", title: "", description: "", width: "", height: "" },
  };
}

const DEFAULT_ADS = {
  topBanner:         makeSlot(),
  topBanner2:        makeSlot(),
  topBanner3:        makeSlot(),
  topBanner4:        makeSlot(),
  sidebar:           makeSlot(),
  inFeed:            makeSlot(),
  stickyBanner:      makeSlot(),
  popunder:          makeSlot(),
  instreamVideo:     makeSlot(),
  instantMessage:    makeSlot(),
  belowDescription:  makeSlot(),
  belowDescription2: makeSlot(),
  belowDescription3: makeSlot(),
  belowDescription4: makeSlot(),
  nativeFeed1:       makeSlot(),
  nativeFeed2:       makeSlot(),
  nativeFeed3:       makeSlot(),
  nativeFeed4:       makeSlot(),
  entryPopup:        makeSlot(),
  playRedirect:      makeSlot(),
};

function mergeAds(remote) {
  const result = {};
  for (const key of Object.keys(DEFAULT_ADS)) {
    const remoteSlot = remote?.[key] || {};
    result[key] = {
      desktop: { ...DEFAULT_ADS[key].desktop, ...(remoteSlot.desktop || {}) },
      mobile:  { ...DEFAULT_ADS[key].mobile,  ...(remoteSlot.mobile  || {}) },
    };
  }
  return result;
}

export function AdsProvider({ children }) {
  const [ads, setAds] = useState(DEFAULT_ADS);
  const [adsLoaded, setAdsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    adsApi.get()
      .then(res => setAds(mergeAds(res.data)))
      .catch(() => {})
      .finally(() => setAdsLoaded(true));
  }, []);

  function getSlot(key) {
    const slot = ads[key];
    if (!slot) return null;
    return isMobile ? slot.mobile : slot.desktop;
  }

  return (
    <AdsContext.Provider value={{ ads, setAds, isMobile, getSlot, adsLoaded }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}
