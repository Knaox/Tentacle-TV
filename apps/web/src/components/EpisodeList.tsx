import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle/api-client";
import { Shimmer } from "@tentacle/ui";
import type { MediaItem } from "@tentacle/shared";

export function EpisodeList({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: seasons, isLoading: seasonsLoading } = useSeasons(seriesId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes(seriesId, selectedSeasonId);

  useEffect(() => {
    if (seasons?.length && !selectedSeasonId) setSelectedSeasonId(seasons[0].Id);
  }, [seasons, selectedSeasonId]);

  return (
    <div className="px-4 md:px-12 py-4">
      {/* Season tabs */}
      {seasonsLoading ? (
        <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} width="100px" height="36px" />)}</div>
      ) : (
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {seasons?.map((s) => (
            <button
              key={s.Id}
              onClick={() => setSelectedSeasonId(s.Id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedSeasonId === s.Id
                  ? "bg-tentacle-accent text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s.Name}
            </button>
          ))}
        </div>
      )}

      {/* Episodes */}
      <div className="space-y-3">
        {episodesLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} height="100px" />)
        ) : (
          episodes?.map((ep) => (
            <EpisodeRow key={ep.Id} episode={ep} client={client} onPlay={() => navigate(`/watch/${ep.Id}`)} />
          ))
        )}
      </div>
    </div>
  );
}

function EpisodeRow({ episode: ep, client, onPlay }: { episode: MediaItem; client: ReturnType<typeof useJellyfinClient>; onPlay: () => void }) {
  const thumbUrl = ep.ImageTags?.Primary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 85 })
    : ep.SeriesId ? client.getImageUrl(ep.SeriesId, "Backdrop", { width: 300, quality: 85 }) : "";

  const progress = ep.UserData?.PlayedPercentage;
  const played = ep.UserData?.Played;
  const runtime = ep.RunTimeTicks ? Math.floor(ep.RunTimeTicks / 600_000_000 * 60) : null;

  return (
    <div onClick={onPlay}
      className="group flex cursor-pointer gap-4 rounded-xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.07]">
      {/* Thumbnail */}
      <div className="relative w-28 flex-shrink-0 overflow-hidden rounded-lg bg-tentacle-surface sm:w-44">
        <div className="aspect-video">
          {thumbUrl && <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
            <svg className="ml-0.5 h-5 w-5 text-tentacle-bg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
        {progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {ep.IndexNumber}. {ep.Name}
          </span>
          {played && <span className="text-xs text-tentacle-accent">Vu</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
          {runtime && <span>{runtime} min</span>}
          {ep.PremiereDate && <span>{new Date(ep.PremiereDate).toLocaleDateString("fr-FR")}</span>}
        </div>
        {ep.Overview && <p className="mt-1.5 text-xs leading-relaxed text-white/50 line-clamp-2">{ep.Overview}</p>}
      </div>
    </div>
  );
}
