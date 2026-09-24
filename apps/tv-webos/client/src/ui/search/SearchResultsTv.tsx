import { memo, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem, SearchItemHit, SearchMediaItem, SearchPersonHit, SearchTopHit } from "@tentacle-tv/shared";
import type { TvSearchFacet, TvSearchNotice, TvSearchSection } from "@tentacle-tv/tv-core";
import { MediaRow } from "../rows/RowTv";
import { SearchTopHitTv } from "./SearchTopHitTv";
import { SearchPeopleRowTv } from "./SearchPersonTv";
import { SearchChipTv } from "./SearchChipTv";

export interface SearchResultsActions {
  onOpenItem: (itemId: string) => void;
  onOpenPerson: (person: SearchPersonHit, opener: HTMLElement) => void;
  onOpenTopPerson: (top: SearchTopHit, opener: HTMLElement) => void;
  onOpenFacet: (facet: TvSearchFacet, opener: HTMLElement) => void;
}

/** Les cartes lisent un `MediaItem` : un résultat du moteur en est un
 *  sous-ensemble (mêmes champs Jellyfin, tronqués à ce qu'une carte montre). */
const asMediaItems = (items: SearchMediaItem[]) => items as unknown as MediaItem[];

/**
 * Les résultats, en rangées : le meilleur résultat, puis une rangée par
 * catégorie dans l'ordre de `tvSearchSections` (tv-core, commun avec l'Apple
 * TV et Android TV) — chercher un acteur met « Personnes » juste sous lui.
 *
 * Les titres passent par la rangée du téléviseur (`RowTv`) : mêmes cartes,
 * même fenêtrage, même piste que l'accueil. L'appui y ouvre la fiche, et la
 * surcouche reste là pour le retour.
 */
export const SearchResultsTv = memo(function SearchResultsTv({ sections, notice, actions }: {
  sections: TvSearchSection[];
  notice: TvSearchNotice;
  actions: SearchResultsActions;
}) {
  const { t } = useTranslation("search");
  return (
    <>
      <NoticeLine notice={notice} />
      {sections.map((section) => {
        switch (section.key) {
          case "top":
            return (
              <div key="top" className="tv-search-top-slot">
                <SearchTopHitTv
                  top={section.top}
                  onOpenItem={actions.onOpenItem}
                  onOpenPerson={(opener) => actions.onOpenTopPerson(section.top, opener)}
                />
              </div>
            );
          case "movies":
          case "series":
          case "collections":
            return (
              <HitsRow
                key={section.key}
                title={t(section.key)}
                count={t("countTitles", { count: section.total })}
                hits={section.hits}
              />
            );
          case "people":
            return <SearchPeopleRowTv key="people" people={section.people} onOpen={actions.onOpenPerson} />;
          case "episodes":
            return (
              <MediaRow key="episodes" title={t("episodes")} items={asMediaItems(section.episodes)} variant="episode" />
            );
          case "facets":
            return <FacetChips key="facets" facets={section.facets} onOpen={actions.onOpenFacet} />;
        }
      })}
    </>
  );
});

/** Une rangée de titres, son compte à côté du titre. Mémoïsée sur la liste :
 *  une frappe qui ne change pas la catégorie ne remonte pas ses cartes. */
const HitsRow = memo(function HitsRow({ title, count, hits }: { title: string; count: string; hits: SearchItemHit[] }) {
  const items = useMemo(() => asMediaItems(hits.map((hit) => hit.item)), [hits]);
  const trailing = useMemo(() => <span className="tv-search-count">{count}</span>, [count]);
  return <MediaRow title={title} items={items} headerTrailing={trailing} />;
});

/** Les genres et studios qui répondent : chacun ouvre son étagère de la bibliothèque. */
const FacetChips = memo(function FacetChips({ facets, onOpen }: {
  facets: TvSearchFacet[];
  onOpen: (facet: TvSearchFacet, opener: HTMLElement) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <section className="tv-search-section" aria-label={t("facets")}>
      <h2 className="tv-search-section-title">{t("facets")}</h2>
      <ul className="tv-search-chips">
        {facets.map((facet) => (
          <li key={`${facet.kind}:${facet.name}`}>
            <FacetChip facet={facet} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
});

function FacetChip({ facet, onOpen }: { facet: TvSearchFacet; onOpen: (facet: TvSearchFacet, opener: HTMLElement) => void }) {
  const { t } = useTranslation("search");
  const self = useRef<HTMLButtonElement>(null);
  return (
    <SearchChipTv
      ref={self}
      label={facet.name}
      detail={t(facet.kind)}
      capitalize
      onClick={() => self.current && onOpen(facet, self.current)}
    />
  );
}

/** Une seule phrase au-dessus des rangées : correction, réponse partielle, index. */
function NoticeLine({ notice }: { notice: TvSearchNotice }) {
  const { t } = useTranslation("search");
  if (!notice) return null;
  if (notice.kind === "correction") {
    return (
      <p className="tv-search-notice" data-kind="correction">
        {t("resultsFor")} « {notice.correction} »
      </p>
    );
  }
  return <p className="tv-search-notice">{notice.kind === "partial" ? t("partial") : t("indexing")}</p>;
}
