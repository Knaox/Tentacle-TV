import { useParams, useNavigate } from "react-router-dom";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle/api-client";
import { formatDuration } from "@tentacle/shared";
import { Navbar } from "../components/Navbar";
import { CastRow } from "../components/CastRow";
import { EpisodeList } from "../components/EpisodeList";
import { MediaCarousel } from "../components/MediaCarousel";

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const { data: similar } = useSimilarItems(itemId);

  if (isLoading || !item) {
    return (
      <div className="flex h-screen items-center justify-center bg-tentacle-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  const isSeries = item.Type === "Series";
  const isEpisode = item.Type === "Episode";
  const backdropId = item.ParentBackdropItemId ?? item.Id;
  const backdropUrl = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
  const posterUrl = item.ImageTags?.Primary
    ? client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 })
    : null;

  const runtime = formatDuration(item.RunTimeTicks);

  const progress = item.UserData?.PlayedPercentage;
  const hasResume = progress != null && progress > 0 && progress < 100;

  const handlePlay = () => {
    if (isSeries) return; // Can't directly play a series
    navigate(`/watch/${item.Id}`);
  };

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />

      {/* Hero backdrop */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <img src={backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="-mt-48 relative z-10 px-12">
        <div className="flex gap-8">
          {/* Poster */}
          {posterUrl && (
            <div className="hidden flex-shrink-0 md:block">
              <img src={posterUrl} alt={item.Name} className="w-56 rounded-xl shadow-2xl" draggable={false} />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 pt-4">
            <h1 className="text-4xl font-bold text-white">{item.Name}</h1>
            {isEpisode && item.SeriesName && (
              <p className="mt-1 text-lg text-white/50">{item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}</p>
            )}

            {/* Metadata row */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.OfficialRating && (
                <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">{item.OfficialRating}</span>
              )}
              {item.CommunityRating && (
                <span className="flex items-center gap-1">
                  <StarIcon /> {item.CommunityRating.toFixed(1)}
                </span>
              )}
              {runtime && <span>{runtime}</span>}
              {isSeries && item.ChildCount && <span>{item.ChildCount} saisons</span>}
              {isSeries && item.Status && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                  {item.Status === "Continuing" ? "En cours" : "Terminée"}
                </span>
              )}
            </div>

            {/* Genres */}
            {item.Genres && item.Genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.Genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">{g}</span>
                ))}
              </div>
            )}

            {/* Tagline */}
            {item.Taglines?.[0] && (
              <p className="mt-4 text-sm italic text-white/40">« {item.Taglines[0]} »</p>
            )}

            {/* Overview */}
            {item.Overview && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">{item.Overview}</p>
            )}

            {/* Action buttons */}
            <div className="mt-5 flex gap-3">
              {!isSeries && (
                <button onClick={handlePlay}
                  className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 font-semibold text-tentacle-bg transition-transform hover:scale-105">
                  <PlayIcon /> {hasResume ? "Reprendre" : "Lecture"}
                </button>
              )}
              {hasResume && !isSeries && (
                <div className="flex items-center text-sm text-white/40">
                  {Math.round(progress)}% visionné
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Episodes (Series only) */}
      {isSeries && itemId && (
        <div className="mt-8">
          <h2 className="px-12 text-xl font-semibold text-white">Saisons & Épisodes</h2>
          <EpisodeList seriesId={itemId} />
        </div>
      )}

      {/* Cast */}
      {item.People && item.People.length > 0 && (
        <div className="mt-6">
          <CastRow people={item.People} />
        </div>
      )}

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <div className="mt-6 pb-16">
          <MediaCarousel title="Titres similaires" items={similar} />
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}

function StarIcon() {
  return <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
}
