import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatEpisodeCode, type SearchMediaItem } from "@tentacle-tv/shared";
import { CardProgressBar } from "../../cards/CardProgressBar";
import { CardStatusMarkers } from "../../cards/CardStatusMarkers";
import { HighlightedText } from "../HighlightedText";
import { PosterThumb } from "../SearchThumbs";
import { SelectionMark } from "../../libraryDelete/SelectionMark";
import { useSearchSelection } from "./searchDeletion";

const WATCHED_ONLY = ["watched"] as const;

/**
 * Un épisode trouvé : sa vignette, son nom, sa série et son code. En mode
 * sélection (supprimer des titres), la ligne entière coche — Maj + clic pour une
 * plage — et la case se pose dans le coin de la vignette.
 */
export const SearchEpisodeRow = memo(function SearchEpisodeRow({ item, terms, onOpen }: {
  item: SearchMediaItem;
  terms: readonly string[];
  onOpen: (item: SearchMediaItem) => void;
}) {
  const { t } = useTranslation("libraryDelete");
  const selection = useSearchSelection(item.Id);
  const locked = selection?.mark === "locked" || selection?.mark === "pending";
  return (
    <li title={selection?.mark === "locked" ? t("notDeletable") : undefined}>
      <button
        type="button"
        role={selection ? "checkbox" : undefined}
        aria-checked={selection ? selection.mark === "selected" : undefined}
        aria-disabled={selection ? locked : undefined}
        aria-label={selection ? t("checkTitle", { name: item.Name }) : undefined}
        onMouseDown={(e) => { if (selection && e.shiftKey) e.preventDefault(); }}
        onClick={(e) => {
          if (!selection) return onOpen(item);
          if (!locked) selection.toggle(item.Id, e.shiftKey);
        }}
        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          selection?.mark === "selected" ? "ring-2 ring-[var(--brand)]" : ""
        } ${selection && locked ? "cursor-not-allowed opacity-40" : ""}`}
      >
        <PosterThumb item={item} height={180} className="aspect-video w-32 rounded-lg">
          {/* Les marques de toutes les cartes : la pastille « vu », sinon la
              barre de progression commune. */}
          {item.UserData?.Played ? (
            <CardStatusMarkers statuses={WATCHED_ONLY} className="right-1 top-1" />
          ) : (
            <CardProgressBar percent={item.UserData?.PlayedPercentage} />
          )}
          {selection && <SelectionMark mark={selection.mark} />}
        </PosterThumb>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-content-primary">
            <HighlightedText text={item.Name} terms={terms} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-content-tertiary">
            {item.SeriesName}
            {item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined && ` · ${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber)}`}
          </span>
        </span>
      </button>
    </li>
  );
});
