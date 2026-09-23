/**
 * Le MEILLEUR RÉSULTAT de l'omnibox — ce que la recherche est sûre d'avoir
 * compris, en grand : l'affiche et l'identité d'un titre, avec « Lire » (un
 * film se lance d'ici, sans passer par sa fiche), ou le portrait d'une
 * personne et ce qu'elle représente dans la bibliothèque.
 *
 * C'est une option de la liste comme les autres (↵ l'ouvre) ; le bouton
 * « Lire » est un raccourci à la souris, hors de l'ordre du clavier.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchItemHit, SearchPersonHit } from "@tentacle-tv/shared";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar, PosterThumb } from "../SearchThumbs";
import { itemMeta, matchReason, personMeta } from "../searchLabels";
import { optionId, type RowProps } from "./OmniboxRows";

function Shell({ index, active, onHover, onActivate, children }: RowProps & { children: React.ReactNode }) {
  return (
    <div
      id={optionId(index)}
      role="option"
      aria-selected={active}
      onMouseMove={() => { if (!active) onHover(index); }}
      onClick={() => onActivate(index)}
      className={`relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-3 transition-colors duration-100 ${
        active ? "border-[rgba(var(--brand-rgb),0.4)] bg-fill-soft" : "border-line-subtle bg-fill-faint"
      }`}
    >
      {children}
    </div>
  );
}

export const TopItemHit = memo(function TopItemHit({
  hit,
  terms,
  onPlay,
  ...row
}: RowProps & { hit: SearchItemHit; terms: readonly string[]; onPlay: (id: string) => void }) {
  const { t, i18n } = useTranslation("search");
  const reason = matchReason(t, hit.match);
  const progress = hit.item.UserData?.PlayedPercentage ?? 0;
  const playable = hit.item.Type === "Movie";
  return (
    <Shell {...row}>
      <PosterThumb item={hit.item} height={200} className="h-[96px] w-16 rounded-lg shadow-[var(--elev-1)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold tracking-tight text-content-primary">
          <HighlightedText text={hit.item.Name} terms={terms} />
        </p>
        <p className="mt-1 truncate text-[13px] text-content-tertiary">{itemMeta(t, hit.item, i18n.language)}</p>
        {reason && (
          <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--brand-light)]">
            <span className="truncate">{reason}</span>
          </span>
        )}
      </div>
      {playable && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onPlay(hit.item.Id); }}
          className="flex shrink-0 items-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-4 py-2 text-[13px] font-bold text-cta-primary-fg transition-transform duration-150 hover:scale-[1.03] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          {progress > 0 && !hit.item.UserData?.Played ? t("resume") : t("play")}
        </button>
      )}
    </Shell>
  );
});

export const TopPersonHit = memo(function TopPersonHit({
  person,
  terms,
  ...row
}: RowProps & { person: SearchPersonHit; terms: readonly string[] }) {
  const { t } = useTranslation("search");
  return (
    <Shell {...row}>
      <PersonAvatar person={person} size={72} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold tracking-tight text-content-primary">
          <HighlightedText text={person.name} terms={terms} />
        </p>
        <p className="mt-1 truncate text-[13px] text-content-tertiary">{personMeta(t, person)}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--brand-light)]">
          {t("filmography")}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Shell>
  );
});
