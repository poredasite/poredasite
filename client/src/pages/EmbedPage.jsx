import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { videoApi } from "../api";
import VideoPlayer from "../components/VideoPlayer";

const SITE = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";

export default function EmbedPage() {
  const { id } = useParams();
  const [video,   setVideo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    videoApi.getById(id)
      .then((res) => setVideo(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !video?.videoUrl) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        <p className="text-gray-500 text-sm">Video bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-black" style={{ minHeight: "100vh" }}>
      <VideoPlayer
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        title={video.title}
        videoId={video._id}
        mp4FallbackUrl={video.mp4FallbackUrl || null}
        onWatchProgress={({ watchedSeconds, duration }) => {
          if (watchedSeconds >= 5) {
            videoApi.recordWatch(video._id, { watchTime: watchedSeconds, duration }).catch(() => {});
          }
        }}
      />
      {/* Attribution link — backlink from embed sites */}
      <div className="bg-black px-3 py-2 flex items-center justify-between">
        <p className="text-gray-600 text-xs truncate max-w-[70%]">{video.title}</p>
        <a
          href={`${SITE}/video/${video._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 hover:text-brand-400 text-xs font-semibold transition-colors flex-shrink-0"
        >
          xxxporeda.com ↗
        </a>
      </div>
    </div>
  );
}
