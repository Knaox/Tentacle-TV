import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  sagaLabel, sagaSummary, sagaTitle,
  type MediaItem, type SagaLibraryEntry, type SagaView,
} from "@tentacle-tv/shared";
import { PosterCard } from "@/components/cards/PosterCard";
import { useDetailSaga } from "@/components/detail/saga/useDetailSaga";
import { RowHeader } from "@/components/rows/RowHeader";
import { useRowCardWidth } from "@/components/rows/useRowCardWidth";
import { FocusableCard } from "../cards/FocusableCard";

/**
 * La saga d'un film sur la fiche, atteignable à la télécommande.
 *
 * La rangée du web est un défileur maison : ses cartes sont des `<div
 * onClick>`, invisibles pour le moteur de navigation. Même données
 * (`useDetailSaga`), mais la grammaire de `TrackTv` : une `data-tv-piste`
 * (confinement horizontal, défilement suivi par le focus) et chaque volet
 * dans une `FocusableCard` (appui court = la carte, maintien = la fiche).
 *
 * Sur la dalle, la bibliothèque seule : le shim des plugins n'en déclare
 * aucun, il n'y a pas de volet manquant à montrer.
 *
 * Le film ouvert reste focalisable — un trou dans la piste désorienterait —
 * mais inerte : on y est déjà. L'étiquette vit SOUS la carte : la carte
 * focalisée grandit vers le haut (`transform-origin: center bottom`).
 */
export function SagaSection({ item }: { item: MediaItem }) {
  const view = useDetailSaga(item);
  const entries = useMemo(
    () => (view?.entries ?? []).filter((entry): entry is SagaLibraryEntry => entry.kind === "library"),
    [view],
  );
  return view === null || entries.length < 2 ? null : <SagaRowTv view={view} entries={entries} />;
}

function SagaRowTv({ view, entries }: { view: SagaView; entries: SagaLibraryEntry[] }) {
  const { t } = useTranslation("media");
  // Monté avec la saga : les mesures du défileur s'attachent à SON montage.
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidth = useRowCardWidth(scrollRef, "poster");
  const [internalFocus, setInternalFocus] = useState(false);
  const onActiveIndex = useCallback((index: number | null) => setInternalFocus(index !== null), []);
  const title = sagaTitle(t, view);

  return (
    <section className="group/row relative mb-10" aria-label={title}>
      {/* Le résumé à la taille du titre (20 px) : la feuille TV porte toute
          petite taille (`text-xs`, `text-sm`) à 24 px, et « 8 films · 6 dans la
          bibliothèque » dominait alors le nom de la saga. La graisse et la
          couleur font la hiérarchie. */}
      <RowHeader
        title={title}
        trailing={<span className="text-heading-2 font-normal text-content-tertiary">{sagaSummary(t, view)}</span>}
      />
      <div
        ref={scrollRef}
        data-tv-piste
        data-focus-interne={internalFocus}
        className="row-dim row-gutter flex gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide"
      >
        {entries.map((entry, index) => {
          const { rank, cue } = sagaLabel(t, entry);
          return (
            <div key={entry.key} className="flex flex-shrink-0 flex-col" style={cardWidth ? { width: cardWidth } : undefined}>
              {entry.cue === "current" ? (
                <div
                  role="button"
                  tabIndex={0}
                  data-tv-carte
                  aria-current="page"
                  className="carte-tv relative flex-shrink-0 rounded-xl ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-2 ring-offset-surface-0"
                  onFocus={() => onActiveIndex(index)}
                  onBlur={() => onActiveIndex(null)}
                >
                  <PosterCard item={entry.item} index={index} width={cardWidth} />
                </div>
              ) : (
                <FocusableCard index={index} width={cardWidth} itemId={entry.item.Id} item={entry.item} onActiveIndex={onActiveIndex}>
                  <PosterCard item={entry.item} index={index} width={cardWidth} />
                </FocusableCard>
              )}
              {/* Le rang et la mention sur DEUX lignes : la feuille TV porte
                  `text-sm` à 24 px, et « Volet 4 · Cette fiche » ne tenait pas
                  sur une carte de 205 px. */}
              {rank !== null && <p className="mt-2 truncate px-0.5 text-sm font-medium text-content-tertiary">{rank}</p>}
              {cue !== null && <p className="truncate px-0.5 text-sm font-semibold text-brand-light">{cue}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
