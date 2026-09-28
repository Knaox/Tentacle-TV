import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { WatchlistResumeTile } from "./WatchlistResumeTile";

interface WatchlistResumeShelfProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  pendingPlayId: string | null;
}

/**
 * « Reprendre » — les titres commencés de la liste, le dernier regardé en tête.
 * Toucher une vignette LANCE la lecture : c'est la seule promesse de cette
 * rangée. La fiche reste à un clic dans la grille, juste en dessous.
 *
 * Vignettes 16:9 sur l'image de fond du titre — l'affiche 2:3 est déjà celle
 * de la grille, et deux fois la même image à l'écran ne dit rien de plus.
 * La vignette est la carte paysage de toutes les rangées (`WatchlistResumeTile`).
 */
export const WatchlistResumeShelf = memo(function WatchlistResumeShelf({
  items, onPlay, pendingPlayId,
}: WatchlistResumeShelfProps) {
  const { t } = useTranslation("watchlist");
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="watchlist-resume-title" className="mb-8">
      {/* Sous le panneau d'outils, sur la page : texte thémé. */}
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id="watchlist-resume-title" className="text-lg font-bold tracking-tight text-content-primary">
          {t("resumeTitle")}
        </h2>
        <span className="text-xs text-content-tertiary">{t("resumeHint")}</span>
      </div>
      <ul className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 pt-3 md:-mx-8 md:scroll-px-8 md:px-8">
        {items.map((item) => (
          <li key={item.Id} className="snap-start">
            <WatchlistResumeTile item={item} onPlay={onPlay} pending={pendingPlayId === item.Id} />
          </li>
        ))}
      </ul>
    </section>
  );
});
