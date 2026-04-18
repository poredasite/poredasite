// Generic skeleton block
export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

// Video card skeleton
export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Thumbnail */}
      <div className="skeleton rounded-xl aspect-video w-full" />
      {/* Text lines */}
      <div className="flex gap-3 px-1">
        <div className="skeleton w-9 h-9 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  );
}

// Grid of card skeletons — matches Home.jsx grid
export function VideoGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-3 gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton rounded-xl w-full" style={{ aspectRatio: "16/9" }} />
          <div className="skeleton h-4 rounded w-3/4" />
          <div className="skeleton h-3 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Video detail page skeleton
export function VideoDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {/* Player */}
          <div className="skeleton rounded-2xl aspect-video w-full mb-5" />
          {/* Title */}
          <div className="skeleton h-7 w-3/4 rounded mb-3" />
          <div className="skeleton h-4 w-1/3 rounded mb-6" />
          {/* Description */}
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
        {/* Sidebar */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton rounded-lg w-40 aspect-video flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3.5 w-full rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
