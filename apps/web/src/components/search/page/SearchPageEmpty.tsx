/**
 * La page de recherche sans requête : une invitation, les recherches récentes
 * à relancer d'un clic, et les genres les plus fournis de la bibliothèque —
 * jamais un écran blanc.
 *
 * Les tuiles de genre sont des tuiles d'ENCRE (`.ui-tile`) : plus de dégradé de
 * marque décoratif (refonte de nov. 2026). En Liquid Glass (mode natif), la
 * tuile prend le remplissage du contenu (`.lg-content`) et la marque ne reste
 * qu'en TOUCHE : un filet d'accent (`.lg-genre-tile`, `data-lg-accent`).
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchDiscover } from "@tentacle-tv/api-client";
import { clearRecentSearches, readRecentSearches } from "../recentSearches";
import { displayFacet } from "../omnibox/OmniboxChips";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";

export const SearchPageEmpty = memo(function SearchPageEmpty({ onQuery, onGenre }: {
  onQuery: (query: string) => void;
  onGenre: (name: string) => void;
}) {
  const { t } = useTranslation("search");
  const [recents, setRecents] = useState(readRecentSearches);
  const { data } = useSearchDiscover();
  return (
    <div className="px-4 pt-10 md:px-12">
      <h1 className="text-display-3 text-content-primary">{t("emptyTitle")}</h1>
      <p className="mt-2 max-w-[65ch] text-sm text-content-tertiary">{t("emptyHint")}</p>
      {recents.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="ui-eyebrow font-sans">{t("recent")}</h2>
            <button type="button" onClick={() => setRecents(clearRecentSearches())} className="btn btn-ghost btn-sm">
              {t("clearRecent")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((query) => (
              <button key={query} type="button" onClick={() => onQuery(query)} className="btn btn-soft">
                <ClockCounterClockwiseIcon aria-hidden size={16} className="text-content-tertiary" />
                {query}
              </button>
            ))}
          </div>
        </section>
      )}
      {data && data.genres.length > 0 && (
        <section className="mt-10">
          <h2 className="ui-eyebrow mb-3 font-sans">{t("browseGenres")}</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {data.genres.map((genre, i) => (
              <button
                key={genre.name}
                type="button"
                onClick={() => onGenre(genre.name)}
                data-lg-accent={i % 2 === 0 ? "brand" : "accent"}
                className="lg-content lg-content-tile lg-genre-tile ui-tile relative flex h-20 flex-col justify-end overflow-hidden p-4 text-left hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                <span className="block truncate font-display text-base font-semibold tracking-tight text-content-primary">{displayFacet(genre.name)}</span>
                <span className="block text-xs tabular-nums text-content-tertiary">{t("countTitles", { count: genre.count })}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
