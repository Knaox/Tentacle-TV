/**
 * L'en-tête de la page de résultats : une VRAIE saisie (les résultats
 * suivent la frappe, comme la page de Google), et les onglets par type avec
 * leur compte. La saisie écrit l'adresse en `replace` : Retour ramène à la
 * page d'avant la recherche, pas à chaque lettre tapée.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { springSoft } from "../../../theme/motion";
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
      <label className="group relative flex h-14 items-center gap-3 rounded-2xl border border-line-subtle bg-fill-subtle px-5 transition-colors focus-within:border-[rgba(var(--brand-rgb),0.55)] focus-within:bg-fill-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-content-tertiary transition-colors group-focus-within:text-[var(--brand-light)]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
        </svg>
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
          className="min-w-0 flex-1 bg-transparent text-lg text-content-primary outline-none placeholder:text-content-tertiary"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => { setValue(""); onQuery(""); inputRef.current?.focus(); }}
            aria-label={t("clear")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-content-tertiary transition-colors hover:bg-fill-medium hover:text-content-primary"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </label>

      {query.trim() !== "" && (
        <div role="tablist" aria-label={t("pageTitle")} className="scrollbar-hide mt-4 flex gap-1 overflow-x-auto">
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
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-150 ${
                  selected ? "font-semibold text-content-primary" : "font-medium text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="search-tab-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-fill-soft ring-1 ring-inset ring-line-subtle"
                    transition={reduced ? { duration: 0 } : springSoft}
                  />
                )}
                <span className="relative">
                  {t(TAB_KEYS[key])}
                  {count !== undefined && count > 0 && <span className="ml-1.5 tabular-nums text-content-quaternary">{count}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
