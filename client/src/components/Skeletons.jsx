export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {/* thumbnail */}
      <div className="skeleton rounded-xl w-full" style={{ aspectRatio: "16/9" }} />
      {/* title — 2 lines like real card */}
      <div className="px-1 space-y-1.5 pt-0.5">
        <div className="skeleton h-3.5 w-full rounded" />
        <div className="skeleton h-3.5 w-4/5 rounded" />
        {/* meta line */}
        <div className="skeleton h-2.5 w-2/5 rounded mt-0.5" />
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VideoDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="sm:px-6 sm:pt-4">
        <div className="skeleton w-full sm:rounded-2xl" style={{ aspectRatio: "16/9" }} />
      </div>
      <div className="px-3 sm:px-6 pt-4 space-y-3">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="border-t border-white/5 pt-4 space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}
