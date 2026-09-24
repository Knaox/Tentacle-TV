/**
 * Les lignes de l'omnibox. Toutes partagent la même coque : une `option` de la
 * liste (ARIA), active au clavier OU au survol — un seul curseur, jamais deux
 * surbrillances à la fois —, marquée d'un filet au dégradé de la marque.
 *
 * Le survol suit `mouseMove` et non `mouseEnter` : une liste qui défile sous un
 * pointeur immobile ne doit pas voler la sélection au clavier.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatEpisodeCode,
  itemMeta,
  matchReason,
  personMeta,
  type ExternalSearchItem,
  type MediaItem,
  type SearchItemHit,
  type SearchMediaItem,
  type SearchPersonHit,
} from "@tentacle-tv/shared";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar, PosterThumb } from "../SearchThumbs";
import { ExternalBadge, ExternalPoster } from "../external/ExternalVisuals";

export interface RowProps {
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onActivate: (index: number) => void;
}

export function optionId(index: number): string {
  return `omnibox-option-${index}`;
}

function RowShell({ index, active, onHover, onActivate, children }: RowProps & { children: ReactNode }) {
  return (
    <div
      id={optionId(index)}
      role="option"
      aria-selected={active}
      onMouseMove={() => { if (!active) onHover(index); }}
      onClick={() => onActivate(index)}
      className={`relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 transition-colors duration-100 ${
        active ? "bg-fill-soft" : ""
      }`}
    >
      {active && (
        <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-gradient-to-b from-[var(--brand)] to-[var(--brand-accent)]" />
      )}
      {children}
      {active && (
        <kbd aria-hidden className="ml-1 hidden shrink-0 rounded-md border border-line-subtle bg-fill-subtle px-1.5 py-0.5 text-[10px] text-content-tertiary sm:inline">
          ↵
        </kbd>
      )}
    </div>
  );
}

/** La reprise en cours, ou « vu » — ce que l'utilisateur sait déjà du titre. */
function WatchState({ item }: { item: SearchMediaItem | MediaItem }) {
  const { t } = useTranslation("search");
  const data = item.UserData;
  if (data?.Played) {
    return (
      <span className="shrink-0 text-[11px] font-medium text-[var(--status-success-fg)]" title={t("watched")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} aria-label={t("watched")}>
          <path d="M5 12.5l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  const progress = data?.PlayedPercentage ?? 0;
  if (progress <= 0) return null;
  return (
    <span aria-hidden className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-fill-medium">
      <span className="block h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]" style={{ width: `${Math.min(100, progress)}%` }} />
    </span>
  );
}

export const ItemRow = memo(function ItemRow({ hit, terms, ...row }: RowProps & { hit: SearchItemHit; terms: readonly string[] }) {
  const { t, i18n } = useTranslation("search");
  const reason = matchReason(t, hit.match);
  return (
    <RowShell {...row}>
      <PosterThumb item={hit.item} height={120} className="h-[54px] w-9 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">
          <HighlightedText text={hit.item.Name} terms={terms} />
        </p>
        <p className="mt-0.5 truncate text-xs text-content-tertiary">
          {itemMeta(t, hit.item, i18n.language)}
          {reason && <span className="text-[var(--brand-light)]"> · {reason}</span>}
        </p>
      </div>
      <WatchState item={hit.item} />
    </RowShell>
  );
});

export const PersonRow = memo(function PersonRow({ person, terms, ...row }: RowProps & { person: SearchPersonHit; terms: readonly string[] }) {
  const { t } = useTranslation("search");
  return (
    <RowShell {...row}>
      <PersonAvatar person={person} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">
          <HighlightedText text={person.name} terms={terms} />
        </p>
        <p className="mt-0.5 truncate text-xs text-content-tertiary">{personMeta(t, person)}</p>
      </div>
    </RowShell>
  );
});

export const EpisodeRow = memo(function EpisodeRow({ item, terms, ...row }: RowProps & { item: SearchMediaItem; terms: readonly string[] }) {
  const code = item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber)
    : null;
  return (
    <RowShell {...row}>
      <PosterThumb item={item} height={90} className="aspect-video w-16 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">
          <HighlightedText text={item.Name} terms={terms} />
        </p>
        <p className="mt-0.5 truncate text-xs text-content-tertiary">
          {item.SeriesName}{code && ` · ${code}`}
        </p>
      </div>
      <WatchState item={item} />
    </RowShell>
  );
});

export const RecentRow = memo(function RecentRow({ query, onRemove, ...row }: RowProps & { query: string; onRemove: (query: string) => void }) {
  const { t } = useTranslation("search");
  return (
    <RowShell {...row}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fill-subtle text-content-tertiary">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-content-secondary">{query}</p>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("removeRecent")}
        title={t("removeRecent")}
        onClick={(e) => { e.stopPropagation(); onRemove(query); }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-content-quaternary transition-colors hover:bg-fill-medium hover:text-content-primary"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </RowShell>
  );
});

export const ResumeRow = memo(function ResumeRow({ item, ...row }: RowProps & { item: MediaItem }) {
  const { t, i18n } = useTranslation("search");
  const title = item.Type === "Episode" && item.SeriesName ? item.SeriesName : item.Name;
  const sub = item.Type === "Episode" ? item.Name : itemMeta(t, item as SearchMediaItem, i18n.language);
  return (
    <RowShell {...row}>
      <PosterThumb item={item as SearchMediaItem} height={90} className="aspect-video w-16 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">{title}</p>
        <p className="mt-0.5 truncate text-xs text-content-tertiary">{sub}</p>
      </div>
      <WatchState item={item} />
    </RowShell>
  );
});

export const AllResultsRow = memo(function AllResultsRow({ query, ...row }: RowProps & { query: string }) {
  const { t } = useTranslation("search");
  return (
    <RowShell {...row}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-light)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{t("allResults", { query })}</p>
    </RowShell>
  );
});

/** Un titre hors bibliothèque : l'affiche du plugin, sa ligne d'identité, sa pastille. */
export const ExternalRow = memo(function ExternalRow({ item, terms, ...row }: RowProps & { item: ExternalSearchItem; terms: readonly string[] }) {
  return (
    <RowShell {...row}>
      <ExternalPoster item={item} className="h-[54px] w-9 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">
          <HighlightedText text={item.title} terms={terms} />
        </p>
        {item.subtitle !== null && <p className="mt-0.5 truncate text-xs text-content-tertiary">{item.subtitle}</p>}
      </div>
      <ExternalBadge badge={item.badge} />
    </RowShell>
  );
});
