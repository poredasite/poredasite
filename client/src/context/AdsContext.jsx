import { createContext, useContext, useEffect, useState } from "react";
import { adsApi } from "../api";

const AdsContext = createContext(null);

const DEFAULT = {
  topBanner: { enabled: false, code: "" },
  sidebar:   { enabled: false, code: "" },
  inFeed:    { enabled: false, code: "" },
};

export function AdsProvider({ children }) {
  const [ads, setAds] = useState(DEFAULT);

  useEffect(() => {
    adsApi.get()
      .then(res => setAds({ ...DEFAULT, ...res.data }))
      .catch(() => {});
  }, []);

  return <AdsContext.Provider value={{ ads, setAds }}>{children}</AdsContext.Provider>;
}

export function useAds() {
  return useContext(AdsContext);
}
