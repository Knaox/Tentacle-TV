import { useNavigate } from "react-router-dom";
import { useLatestItems, useJellyfinClient, useResumeItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface SidebarPreviewPanelProps {
  libraryId: string;
  libraryName: string;
  top: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function SidebarPreviewPanel({
  libraryId,
  libraryName,
  top,
  onMouseEnter,
  onMouseLeave,
}: SidebarPreviewPanelProps) {
  const { data: resumeItems } = useResumeItems();
  const { data: latestItems } = useLatestItems(libraryId);
  const client = useJellyfinClient();
  const navigate = useNavigate();

  // Filter resume items that belong to this library
  const libraryResumeItems = resumeItems?.filter(
    (item) => item.ParentId === libraryId || item.SeriesId,
  ).slice(0, 3);

  const hasResume = libraryResumeItems && libraryResumeItems.length > 0;
  const displayItems = hasResume ? libraryResumeItems : latestItems?.slice(0, 2);
  const subtitle = hasResume ? "Continuer" : "Derniers ajouts";

  if (!displayItems || displayItems.length === 0) return null;

  // Clamp so panel doesn't overflow viewport
  const clampedTop = Math.min(top, window.innerHeight - 360);

  return (
    <div
      className="fixed z-50 animate-slide-in-right"
      style={{ left: 62, top: clampedTop }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="w-[280px] overflow-hidden rounded-2xl"
        style={{
          background: "rgba(15,15,25,0.95)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(139,92,246,0.1)",
          maxHeight: 350,
        }}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold text-white/70">{libraryName}</p>
          <p className="text-xs text-white/40">{subtitle}</p>
        </div>

        <div className="space-y-1 px-3 pb-3">
          {displayItems.map((item, idx) => (
            <PreviewCard
              key={item.Id}
              item={item}
              index={idx}
              client={client}
              onClick={() => {
                if (item.Type === "Episode") navigate(`/watch/${item.Id}`);
                else navigate(`/media/${item.Id}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  item,
  index,
  client,
  onClick,
}: {
  item: MediaItem;
  index: number;
  client: ReturnType<typeof useJellyfinClient>;
  onClick: () => void;
}) {
  const isEpisode = item.Type === "Episode";
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const poster = client.getImageUrl(imageId, "Primary", { height: 180, quality: 80 });
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const title = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;

  const progressLabel = isEpisode
    ? `S${item.ParentIndexNumber}E${item.IndexNumber} · ${Math.round(progress)}%`
    : progress > 0
      ? `${Math.round(progress)}%`
      : "";

  return (
    <button
      onClick={onClick}
      className="group/preview flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-white/5"
      style={{
        animation: `fadeSlideUp 0.3s ease both`,
        animationDelay: `${index * 80}ms`,
      }}
    >
      <img
        src={poster}
        alt=""
        className="h-[90px] w-[60px] flex-shrink-0 rounded-lg object-cover"
        loading="lazy"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/90">{title}</p>
        {progressLabel && (
          <p className="mt-0.5 text-xs text-white/40">{progressLabel}</p>
        )}
        {progress > 0 && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                boxShadow: "0 0 8px rgba(139,92,246,0.5)",
              }}
            />
          </div>
        )}
        {/* Play button on hover */}
        <div className="mt-1.5 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover/preview:opacity-100"
          style={{ background: "rgba(139,92,246,0.85)" }}>
          <svg className="ml-0.5 h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}
