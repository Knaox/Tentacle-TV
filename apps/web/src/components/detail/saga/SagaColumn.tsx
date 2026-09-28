import { memo } from "react";
import { useTranslation } from "react-i18next";
import { sagaLabel, type SagaEntry } from "@tentacle-tv/shared";
import { PosterCard } from "../../cards/PosterCard";
import { POSTER_VW, POSTER_WIDTH } from "../../cards/cardSizes";
import { cardWidthStyle } from "../../cards/cardWidthStyle";
import { ExternalResultCard } from "../../search/external/ExternalResultCard";

/**
 * Un volet de la saga : sa carte — celle des rangées pour un film de la
 * bibliothèque (avec son survol, ses marqueurs, sa progression), celle des
 * résultats hors bibliothèque pour un volet qui manque —, puis son étiquette
 * (« Volet 4 · Cette fiche »).
 *
 * L'étiquette vit SOUS la carte : au-dessus, la carte qui monte au survol (et
 * au focus sur un téléviseur) la couvrirait. Elle garde sa hauteur même vide
 * (sans TMDB, pas de rang) : les rangées de texte restent alignées.
 *
 * Le film de la fiche ouverte est cerclé et inerte : on y est déjà. Le texte
 * « Cette fiche » le dit aussi, la couleur n'est jamais seule à parler.
 */
export const SagaColumn = memo(function SagaColumn({ entry, index, width }: {
  entry: SagaEntry;
  index: number;
  /** Largeur calée par la rangée (`useRowCardWidth`) ; null → le `clamp` des cartes. */
  width: number | null;
}) {
  const { t } = useTranslation("media");
  const { rank, cue } = sagaLabel(t, entry);
  const current = entry.kind === "library" && entry.cue === "current";

  return (
    <div
      className="flex flex-shrink-0 snap-start flex-col"
      style={{ width: cardWidthStyle(width, POSTER_WIDTH.md, POSTER_VW) }}
      aria-current={current ? "page" : undefined}
    >
      {entry.kind === "external" ? (
        <ExternalResultCard item={entry.item} />
      ) : current ? (
        <div className="pointer-events-none rounded-xl ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-2 ring-offset-surface-0">
          <PosterCard item={entry.item} index={index} width={width} />
        </div>
      ) : (
        <PosterCard item={entry.item} index={index} width={width} />
      )}
      {/* Casse normale : en capitales espacées, « Volet 8 · Cette fiche »
          débordait d'une carte de 150 px (fenêtre de 1024). */}
      <p className="mt-1 h-4 truncate px-0.5 text-xs font-medium leading-4 text-content-tertiary">
        {rank}
        {rank !== null && cue !== null && <span aria-hidden> · </span>}
        {cue !== null && <span className="font-semibold text-brand-light">{cue}</span>}
      </p>
    </div>
  );
});
