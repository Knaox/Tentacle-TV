/**
 * Les lignes de l'omnibox. Toutes partagent la même coque : une `option` de la
 * liste (ARIA), active au clavier OU au survol — un seul curseur, jamais deux
 * surbrillances à la fois —, marquée d'un filet au dégradé de la marque.
 *
 * Le survol suit `mouseMove` et non `mouseEnter` : une liste qui défile sous un
 * pointeur immobile ne doit pas voler la sélection au clavier.
 */

import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon as Plus } from "@phosphor-icons/react/dist/csr/Plus";
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
import { WatchedGlyph } from "../../cards/cardGlyphs";
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
      data-lg-active={active}
      onMouseMove={() => { if (!active) onHover(index); }}
      onClick={() => onActivate(index)}
      className={`relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 ${
        active ? "bg-fill-soft" : ""
      }`}
    >
      {active && (
        <span aria-hidden className="lg-row-mark absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-accent" />
      )}
      {children}
      {active && (
        <kbd aria-hidden className="ui-kbd ml-1 hidden shrink-0 sm:inline">
          ↵
        </kbd>
      )}
    </div>
  );
}

/**
 * La reprise en cours, ou « vu » — ce que l'utilisateur sait déjà du titre.
 * « Vu » prend le glyphe du modèle des cartes (disque plein, coche évidée) :
 * une coche verte maison en tenait lieu, un troisième dessin de « vu ».
 */
function WatchState({ item }: { item: SearchMediaItem | MediaItem }) {
  const { t } = useTranslation("search");
  const data = item.UserData;
  if (data?.Played) {
    return (
      <span role="img" aria-label={t("watched")} title={t("watched")} className="shrink-0 text-accent">
        <WatchedGlyph className="h-4 w-4" filled />
      </span>
    );
  }
  const progress = data?.PlayedPercentage ?? 0;
  if (progress <= 0) return null;
  return (
    <span aria-hidden className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-fill-medium">
      <span className="block h-full origin-left rounded-full" style={{ transform: `scaleX(${Math.min(100, progress) / 100})`, background: "var(--gauge-gradient)" }} />
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
          {reason && <span className="text-accent"> · {reason}</span>}
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
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-fill-subtle text-content-tertiary">
        <ClockCounterClockwiseIcon size={16} />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-content-secondary">{query}</p>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("removeRecent")}
        title={t("removeRecent")}
        onClick={(e) => { e.stopPropagation(); onRemove(query); }}
        className="icon-btn btn-sm"
      >
        <XIcon size={14} weight="bold" aria-hidden />
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
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
        <MagnifyingGlassIcon size={16} />
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

/**
 * Une série de la bibliothèque à qui il manque des saisons : son affiche, son
 * nom, et « 2 saisons à demander » au ton de la marque. ↵ ouvre la feuille de
 * ses saisons (l'omnibox se referme d'abord).
 */
export const MissingSeasonsRow = memo(function MissingSeasonsRow({ item, count, terms, ...row }: RowProps & {
  item: SearchMediaItem;
  count: number;
  terms: readonly string[];
}) {
  const { t } = useTranslation("search");
  return (
    <RowShell {...row}>
      <PosterThumb item={item} height={120} className="h-[54px] w-9 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-secondary">
          <HighlightedText text={item.Name} terms={terms} />
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-accent">
          <Plus weight="bold" className="h-3 w-3 shrink-0" aria-hidden />
          {t("requests:missingSeasons", { count })}
        </p>
      </div>
    </RowShell>
  );
});
