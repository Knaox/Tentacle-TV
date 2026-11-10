import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";

/** Saisons puis épisodes d'une série, dans la liste déroulante du sélecteur. */
export function SeriesEpisodePicker({ series, seasons, episodes, selectedSeasonId, onSeasonChange, onEpisodeSelect, onBack, client }: {
  series: MediaItem;
  seasons: MediaItem[] | undefined;
  episodes: MediaItem[] | undefined;
  selectedSeasonId: string | null;
  onSeasonChange: (id: string) => void;
  onEpisodeSelect: (ep: MediaItem) => void;
  onBack: () => void;
  client: any;
}) {
  const { t } = useTranslation("common");

  useEffect(() => {
    if (seasons && seasons.length > 0 && !selectedSeasonId) {
      onSeasonChange(seasons[0].Id);
    }
  }, [seasons, selectedSeasonId, onSeasonChange]);

  return (
    <div>
      <button onClick={onBack} type="button" className="flex w-full items-center gap-2 border-b border-line-subtle px-3 py-2.5 text-xs font-semibold text-content-tertiary transition-colors duration-hover hover:text-content-primary">
        &larr; {series.Name}
      </button>
      {seasons && seasons.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-line-subtle px-3 py-2">
          {seasons.map((s) => (
            <button key={s.Id} type="button" onClick={() => onSeasonChange(s.Id)}
              className={`inline-flex h-7 flex-shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-colors duration-hover ${selectedSeasonId === s.Id ? "bg-surface-4 text-content-primary" : "bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"}`}>
              {s.Name}
            </button>
          ))}
        </div>
      )}
      {!episodes && <p className="px-3 py-2.5 text-xs text-content-tertiary">{t("common:loading")}</p>}
      {episodes?.map((ep) => {
        const thumb = ep.ImageTags?.Primary ? client.getImageUrl(ep.Id, "Primary", { width: 120, quality: 70 }) : null;
        return (
          <button key={ep.Id} type="button" onClick={() => onEpisodeSelect(ep)}
            className="flex w-full items-center gap-3 rounded-field px-3 py-2 text-left transition-colors duration-hover hover:bg-fill-soft">
            {thumb ? (
              <img src={thumb} alt="" className="h-8 w-14 rounded-chip object-cover" />
            ) : (
              <div className="num flex h-8 w-14 items-center justify-center rounded-chip bg-fill-soft text-xs text-content-tertiary">{ep.IndexNumber}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-content-primary truncate">E{ep.IndexNumber} — {ep.Name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
