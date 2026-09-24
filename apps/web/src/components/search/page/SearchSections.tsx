/**
 * Les briques de la page de résultats : une section titrée (« Films · 24 —
 * Tout voir »), une grille d'affiches — la carte de résultat de toujours —,
 * un bandeau de personnes, une liste d'épisodes, des pastilles.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatEpisodeCode,
  personMeta,
  type SearchFacetHit,
  type SearchMediaItem,
  type SearchPersonHit,
} from "@tentacle-tv/shared";
import { SearchResultCard } from "../SearchResultCard";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar, PosterThumb } from "../SearchThumbs";
import { displayFacet } from "../omnibox/OmniboxChips";

export function Section({ title, count, onSeeAll, children }: {
  title: string;
  count?: number;
  onSeeAll?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("search");
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-content-primary">
          {title}
          {count !== undefined && <span className="ml-2 text-base font-medium tabular-nums text-content-quaternary">{count}</span>}
        </h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-sm font-medium text-[var(--brand-light)] transition-opacity hover:opacity-80">
            {t("seeAll")} →
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
    <ul className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
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
    <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onOpen(person)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line-subtle bg-fill-faint p-3 text-left transition-colors hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
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
      {episodes.map((item) => (
        <li key={item.Id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <PosterThumb item={item} height={180} className="aspect-video w-32 rounded-lg" />
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
      ))}
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
          className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-fill-subtle px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-content-quaternary">{t(kind)}</span>
          <span className="font-medium">{displayFacet(facet.name)}</span>
          <span className="tabular-nums text-content-quaternary">{facet.count}</span>
        </button>
      ))}
    </div>
  );
});
