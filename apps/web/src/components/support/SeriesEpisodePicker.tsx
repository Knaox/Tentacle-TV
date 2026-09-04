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
      <button onClick={onBack} type="button" className="flex w-full items-center gap-2 border-b border-line-subtle px-4 py-2.5 text-xs text-content-tertiary hover:text-content-primary">
        &larr; {series.Name}
      </button>
      {seasons && seasons.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-line-subtle px-3 py-2">
          {seasons.map((s) => (
            <button key={s.Id} type="button" onClick={() => onSeasonChange(s.Id)}
              className={`flex-shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${selectedSeasonId === s.Id ? "bg-[var(--brand-soft)] border border-[var(--brand)]/45 text-[var(--brand-light)]" : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft"}`}>
              {s.Name}
            </button>
          ))}
        </div>
      )}
      {!episodes && <p className="px-4 py-3 text-xs text-content-quaternary">{t("common:loading")}</p>}
      {episodes?.map((ep) => {
        const thumb = ep.ImageTags?.Primary ? client.getImageUrl(ep.Id, "Primary", { width: 120, quality: 70 }) : null;
        return (
          <button key={ep.Id} type="button" onClick={() => onEpisodeSelect(ep)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-fill-subtle">
            {thumb ? (
              <img src={thumb} alt="" className="h-8 w-14 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-14 items-center justify-center rounded bg-fill-subtle text-xs text-content-disabled">{ep.IndexNumber}</div>
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
