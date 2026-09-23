/**
 * La page de recherche sans requête : une invitation, les recherches récentes
 * à relancer d'un clic, et les genres les plus fournis de la bibliothèque —
 * jamais un écran blanc.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchDiscover } from "@tentacle-tv/api-client";
import { clearRecentSearches, readRecentSearches } from "../recentSearches";
import { displayFacet } from "../omnibox/OmniboxChips";

export const SearchPageEmpty = memo(function SearchPageEmpty({ onQuery, onGenre }: {
  onQuery: (query: string) => void;
  onGenre: (name: string) => void;
}) {
  const { t } = useTranslation("search");
  const [recents, setRecents] = useState(readRecentSearches);
  const { data } = useSearchDiscover();
  return (
    <div className="px-4 pt-10 md:px-12">
      <h1 className="text-3xl font-bold tracking-tight text-content-primary">{t("emptyTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-content-tertiary">{t("emptyHint")}</p>
      {recents.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{t("recent")}</h2>
            <button type="button" onClick={() => setRecents(clearRecentSearches())} className="text-xs font-medium text-content-tertiary hover:text-content-primary">
              {t("clearRecent")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((query) => (
              <button key={query} type="button" onClick={() => onQuery(query)} className="rounded-full border border-line-subtle bg-fill-subtle px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary">
                {query}
              </button>
            ))}
          </div>
        </section>
      )}
      {data && data.genres.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{t("browseGenres")}</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {data.genres.map((genre, i) => (
              <button
                key={genre.name}
                type="button"
                onClick={() => onGenre(genre.name)}
                className="relative flex h-20 items-end overflow-hidden rounded-2xl border border-line-subtle p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                style={{ background: GENRE_TONES[i % GENRE_TONES.length] }}
              >
                <span className="relative">
                  <span className="block text-base font-bold text-content-primary">{displayFacet(genre.name)}</span>
                  <span className="block text-xs text-content-secondary">{t("countTitles", { count: genre.count })}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

/** Des dégradés tirés des jetons de marque — jamais une couleur en dur. */
const GENRE_TONES = [
  "linear-gradient(135deg, rgba(var(--brand-rgb), 0.55), rgba(var(--brand-rgb), 0.18))",
  "linear-gradient(135deg, rgba(var(--brand-accent-rgb), 0.5), rgba(var(--brand-accent-rgb), 0.15))",
  "linear-gradient(135deg, rgba(var(--brand-rgb), 0.4), rgba(var(--brand-accent-rgb), 0.3))",
  "linear-gradient(135deg, var(--fill-strong), var(--fill-soft))",
];
