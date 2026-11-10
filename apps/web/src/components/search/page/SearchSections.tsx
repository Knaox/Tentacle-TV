/**
 * Les briques de la page de résultats : une section titrée (« Films · 24 —
 * Tout voir »), une grille d'affiches — la carte de résultat de toujours —,
 * un bandeau de personnes, une liste d'épisodes, des pastilles.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  personMeta,
  type SearchFacetHit,
  type SearchMediaItem,
  type SearchPersonHit,
} from "@tentacle-tv/shared";
import { SearchResultCard } from "../SearchResultCard";
import { SearchEpisodeRow } from "./SearchEpisodeRow";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar } from "../SearchThumbs";
import { displayFacet } from "../omnibox/OmniboxChips";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";

export function Section({ title, count, onSeeAll, children }: {
  title: string;
  count?: number;
  onSeeAll?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("search");
  return (
    <section className="mt-10">
      <div className="mb-3 flex min-h-8 items-center justify-between gap-4">
        <h2 className="text-heading-2 text-content-primary">
          {title}
          {count !== undefined && <span className="ml-2 font-sans text-sm font-medium tabular-nums tracking-normal text-content-tertiary">{count}</span>}
        </h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="btn btn-ghost btn-sm -mr-2">
            {t("seeAll")}
            <CaretRightIcon aria-hidden size={14} weight="bold" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export const PosterGrid = memo(function PosterGrid({ items, onOpen }: {
  items: readonly SearchMediaItem[];
  onOpen: (item: SearchMediaItem) => void;
}) {
  return (
    // Une pièce de plusieurs lignes : seule la ligne de la carte s'écarte
    // devant sa mini-carte d'aperçu (`cards/preview/room`).
    <ul data-preview-room="grid" className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
      {items.map((item, index) => (
        <SearchResultCard key={item.Id} item={item} index={index} onSelect={() => onOpen(item)} />
      ))}
    </ul>
  );
});

export const PeopleStrip = memo(function PeopleStrip({ people, terms, onOpen }: {
  people: readonly SearchPersonHit[];
  terms: readonly string[];
  onOpen: (person: SearchPersonHit) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onOpen(person)}
            className="ui-tile flex w-full items-center gap-3 p-3 text-left hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <PersonAvatar person={person} size={56} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-content-primary">
                <HighlightedText text={person.name} terms={terms} />
              </span>
              <span className="mt-0.5 block truncate text-xs text-content-tertiary">{personMeta(t, person)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
});

export const EpisodeList = memo(function EpisodeList({ episodes, terms, onOpen }: {
  episodes: readonly SearchMediaItem[];
  terms: readonly string[];
  onOpen: (item: SearchMediaItem) => void;
}) {
  return (
    <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
      {episodes.map((item) => <SearchEpisodeRow key={item.Id} item={item} terms={terms} onOpen={onOpen} />)}
    </ul>
  );
});

export const FacetChips = memo(function FacetChips({ genres, studios, onOpen }: {
  genres: readonly SearchFacetHit[];
  studios: readonly SearchFacetHit[];
  onOpen: (kind: "genre" | "studio", name: string) => void;
}) {
  const { t } = useTranslation("search");
  const chips = [
    ...genres.map((facet) => ({ kind: "genre" as const, facet })),
    ...studios.map((facet) => ({ kind: "studio" as const, facet })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ kind, facet }) => (
        <button
          key={`${kind}:${facet.name}`}
          type="button"
          onClick={() => onOpen(kind, facet.name)}
          className="btn btn-soft"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-content-tertiary">{t(kind)}</span>
          <span>{displayFacet(facet.name)}</span>
          <span className="font-medium tabular-nums text-content-tertiary">{facet.count}</span>
        </button>
      ))}
    </div>
  );
});
