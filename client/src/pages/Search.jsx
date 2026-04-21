import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { videoApi } from "../api";
import VideoCard from "../components/VideoCard";
import { VideoGridSkeleton } from "../components/Skeletons";
import SEOHead from "../components/SEOHead";
import { TopBannerAd, InFeedAd } from "../components/AdPlaceholders";

const PAGE_LIMIT = 24;
const AD_EVERY = 12;

export default function Search() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";

  const [videos,      setVideos]      = useState([]);
  const [total,       setTotal]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const pageRef    = useRef(1);
  const fetchIdRef = useRef(0);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px", threshold: 0 });

  const fetchVideos = useCallback(async (page, append) => {
    if (!q) return;
    const id = ++fetchIdRef.current;
    if (!append) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const res = await videoApi.search(q, { page, limit: PAGE_LIMIT });
      if (id !== fetchIdRef.current) return;
      setVideos((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.pagination?.total ?? 0);
      setHasMore(page < (res.pagination?.pages ?? 1));
      pageRef.current = page;
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      setError(err.message);
    } finally {
      if (id !== fetchIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q]);

  useEffect(() => {
    pageRef.current = 1;
    setVideos([]);
    setHasMore(false);
    setTotal(null);
    fetchVideos(1, false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [q]);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      fetchVideos(pageRef.current + 1, true);
    }
  }, [inView]);

  return (
    <>
      <SEOHead
        title={q ? `"${q}" arama sonuçları` : "Arama"}
        description={q ? `"${q}" için porno video arama sonuçları.` : "Video ara"}
        url={`/search?q=${encodeURIComponent(q)}`}
        noIndex={true}
      />

      <div className="max-w-[1600px] mx-auto px-2 sm:px-5 py-4">

        <TopBannerAd />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-surface-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white leading-tight">
              {q ? `"${q}"` : "Arama"}
            </h1>
            {total != null && (
              <p className="text-neutral-700 text-xs mt-0.5">{total.toLocaleString("tr-TR")} sonuç</p>
            )}
          </div>
        </div>

        {!q && (
          <p className="text-neutral-600 text-sm text-center py-20">
            Arama yapmak için yukarıdaki arama kutusunu kullan.
          </p>
        )}

        {loading && <VideoGridSkeleton count={PAGE_LIMIT} />}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm mb-3">Arama başarısız</p>
            <button onClick={() => fetchVideos(1, false)} className="btn-primary text-sm">Tekrar Dene</button>
          </div>
        )}

        {!loading && !error && q && videos.length === 0 && (
          <div className="text-center py-20 space-y-2">
            <p className="text-white font-semibold">Sonuç bulunamadı</p>
            <p className="text-neutral-600 text-sm">"{q}" için video yok.</p>
          </div>
        )}

        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 animate-fade-in">
            {videos.reduce((acc, v, i) => {
              acc.push(<VideoCard key={v._id} video={v} priority={i < 6} />);
              if ((i + 1) % AD_EVERY === 0 && i < videos.length - 1) acc.push(<InFeedAd key={`ad-${i}`} />);
              return acc;
            }, [])}
          </div>
        )}

        {loadingMore && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 mt-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton rounded-xl" style={{ aspectRatio: "16/9" }} />
                <div className="skeleton h-3.5 rounded w-3/4" />
                <div className="skeleton h-3 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && !loadingMore && !hasMore && videos.length > 0 && (
          <div className="text-center py-10 text-neutral-700 text-xs">
            — Tüm sonuçlar yüklendi —
          </div>
        )}

        <div ref={sentinelRef} className="h-1" />
      </div>
    </>
  );
}
