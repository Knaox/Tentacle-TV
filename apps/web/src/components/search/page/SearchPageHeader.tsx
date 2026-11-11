/**
 * L'en-tête de la page de résultats : une VRAIE saisie (les résultats
 * suivent la frappe, comme la page de Google), et les onglets par type avec
 * leur compte. La saisie écrit l'adresse en `replace` : Retour ramène à la
 * page d'avant la recherche, pas à chaque lettre tapée.
 *
 * Le champ est la pilule de recherche du socle (`field field-pill`), en grand ;
 * les onglets, la piste du contrôle segmenté : l'onglet retenu est une pastille
 * neutre qui glisse.
 *
 * Liquid Glass (mode natif) : c'est LE champ de recherche de l'écran — la
 * capsule de verre des contrôles de page (`.lg-field`), et la barre du haut
 * retire alors le sien (`TopNav`) : jamais deux recherches à l'écran.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "framer-motion";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { SlidingMarker } from "../../ui/SlidingMarker";
import { SEARCH_TABS, type SearchTab } from "./searchParams";

const WRITE_DELAY_MS = 150;

interface SearchPageHeaderProps {
  query: string;
  tab: SearchTab;
  counts: Partial<Record<SearchTab, number>>;
  onQuery: (query: string) => void;
  onTab: (tab: SearchTab) => void;
}

const TAB_KEYS: Record<SearchTab, string> = {
  all: "all",
  movies: "movies",
  series: "series",
  collections: "collections",
  people: "people",
  episodes: "episodes",
};

export const SearchPageHeader = memo(function SearchPageHeader({ query, tab, counts, onQuery, onTab }: SearchPageHeaderProps) {
  const { t } = useTranslation("search");
  const reduced = useReducedMotion();
  const [value, setValue] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  // L'adresse a changé ailleurs (omnibox, Retour) : la saisie la suit.
  useEffect(() => setValue(query), [query]);

  useEffect(() => {
    if (value.trim() === query.trim()) return;
    const id = setTimeout(() => onQuery(value), WRITE_DELAY_MS);
    return () => clearTimeout(id);
  }, [value, query, onQuery]);

  return (
    <div className="px-4 pt-6 md:px-12">
      {/* Le titre de la page, pour la structure : la saisie dit déjà ce qu'on cherche. */}
      {query.trim() !== "" && <h1 className="sr-only">{t("pageTitle")}</h1>}
      <label className="lg-field field field-pill group flex h-[52px] items-center gap-3 pl-5 pr-2 focus-within:shadow-[inset_0_0_0_1.5px_var(--accent),0_0_0_3px_rgba(var(--accent-rgb),0.22)]">
        <MagnifyingGlassIcon aria-hidden size={20} className="shrink-0 text-content-tertiary transition-colors duration-hover group-focus-within:text-content-primary" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onQuery(value); }}
          placeholder={t("placeholder")}
          aria-label={t("dialog")}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-content-primary outline-none placeholder:text-content-tertiary"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => { setValue(""); onQuery(""); inputRef.current?.focus(); }}
            aria-label={t("clear")}
            title={t("clear")}
            className="icon-btn"
          >
            <XIcon aria-hidden size={18} />
          </button>
        )}
      </label>

      {query.trim() !== "" && (
        // Le défilement est porté par l'enveloppe : la piste garde sa pilule entière.
        <div className="scrollbar-hide mt-4 flex overflow-x-auto">
          <div role="tablist" aria-label={t("pageTitle")} className="lg-seg inline-flex shrink-0 items-center rounded-full bg-surface-2 p-[3px]">
            {SEARCH_TABS.map((key) => {
              const selected = key === tab;
              const count = counts[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onTab(key)}
                  className={`relative isolate inline-flex min-h-[32px] shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-[color,transform] duration-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                    selected ? "text-content-primary" : "text-content-secondary hover:text-content-primary"
                  }`}
                >
                  {selected && (
                    <SlidingMarker
                      group="search-tab-pill"
                      still={reduced === true}
                      className="lg-seg-marker absolute inset-0 -z-10 rounded-full"
                      // L'onglet retenu : une pastille NEUTRE, comme le contrôle segmenté des bibliothèques.
                      style={{ background: "var(--surface-4)", boxShadow: "var(--ctl-glow-segment)" }}
                    />
                  )}
                  {t(TAB_KEYS[key])}
                  {count !== undefined && count > 0 && <span className="ml-1.5 tabular-nums text-content-tertiary">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
