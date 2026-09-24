import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SearchFacetHit } from "@tentacle-tv/shared";
import { SearchChipTv } from "./SearchChipTv";

/**
 * Ce que montre la recherche quand elle n'a pas de résultats à montrer — et
 * qui n'est jamais une impasse : les recherches récentes (un appui les
 * relance), les genres de la bibliothèque à parcourir, et une phrase qui dit
 * ce que le moteur comprend (un acteur, un genre, une faute de frappe).
 */
export const SearchIdleTv = memo(function SearchIdleTv({ mode, query, recents, genres, onPickQuery, onOpenGenre }: {
  /** `idle` : rien de tapé. `empty` : la saisie ne trouve rien. */
  mode: "idle" | "empty";
  query: string;
  recents: string[];
  genres: SearchFacetHit[];
  onPickQuery: (query: string) => void;
  onOpenGenre: (name: string, opener: HTMLElement) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <div className="tv-search-idle">
      <h2 className="tv-search-idle-title">{mode === "idle" ? t("emptyTitle") : t("noResults", { query })}</h2>
      <p className="tv-search-idle-hint">{mode === "idle" ? t("emptyHint") : t("noResultsHint")}</p>

      {recents.length > 0 && (
        <section className="tv-search-section" aria-label={t("recent")}>
          <h3 className="tv-search-section-title">{t("recent")}</h3>
          <ul className="tv-search-chips">
            {recents.map((recent) => (
              <li key={recent}>
                <SearchChipTv label={recent} onClick={() => onPickQuery(recent)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {genres.length > 0 && (
        <section className="tv-search-section" aria-label={t("browseGenres")}>
          <h3 className="tv-search-section-title">{t("browseGenres")}</h3>
          <ul className="tv-search-chips">
            {genres.map((genre) => (
              <li key={genre.name}>
                <GenreChip genre={genre} onOpen={onOpenGenre} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});

function GenreChip({ genre, onOpen }: { genre: SearchFacetHit; onOpen: (name: string, opener: HTMLElement) => void }) {
  const self = useRef<HTMLButtonElement>(null);
  return (
    <SearchChipTv
      ref={self}
      label={genre.name}
      detail={String(genre.count)}
      capitalize
      onClick={() => self.current && onOpen(genre.name, self.current)}
    />
  );
}
