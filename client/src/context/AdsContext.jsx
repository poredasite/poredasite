import { createContext, useContext, useEffect, useState } from "react";
import { adsApi } from "../api";

const AdsContext = createContext(null);

function makeSlot() {
  return {
    desktop: { enabled: false, code: "", vastUrl: "", width: "", height: "" },
    mobile:  { enabled: false, code: "", vastUrl: "", width: "", height: "" },
  };
}

const DEFAULT_ADS = {
  topBanner:        makeSlot(),
  sidebar:          makeSlot(),
  inFeed:           makeSlot(),
  stickyBanner:     makeSlot(),
  popunder:         makeSlot(),
  instreamVideo:    makeSlot(),
  instantMessage:   makeSlot(),
  belowDescription: makeSlot(),
};

function mergeAds(remote) {
  const result = {};
  for (const key of Object.keys(DEFAULT_ADS)) {
    result[key] = {
      desktop: { ...DEFAULT_ADS[key].desktop, ...(remote?.[key]?.desktop || {}) },
      mobile:  { ...DEFAULT_ADS[key].mobile,  ...(remote?.[key]?.mobile  || {}) },
    };
  }
  return result;
}

export function AdsProvider({ children }) {
  const [ads, setAds] = useState(DEFAULT_ADS);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    adsApi.get()
      .then(res => setAds(mergeAds(res.data)))
      .catch(() => {});
  }, []);

  function getSlot(key) {
    const slot = ads[key];
    if (!slot) return null;
    return isMobile ? slot.mobile : slot.desktop;
  }

  return (
    <AdsContext.Provider value={{ ads, setAds, isMobile, getSlot }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}
