/**
 * La liste de l'omnibox, rangée en sections — chaque option garde son indice
 * dans la liste APLATIE, celui que suivent les flèches. Les pastilles (genres,
 * studios) se disposent en ligne ; tout le reste en lignes.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchResponse } from "@tentacle-tv/shared";
import { groupBySection, type OmniboxOption, type OmniboxSection } from "../omniboxModel";
import { FacetChip } from "./OmniboxChips";
import {
  AllResultsRow, EpisodeRow, ExternalRow, ItemRow, PersonRow, RecentRow, ResumeRow, type RowProps,
} from "./OmniboxRows";
import { TopItemHit, TopPersonHit } from "./OmniboxTopHit";

interface OmniboxListProps {
  options: readonly OmniboxOption[];
  activeIndex: number;
  terms: readonly string[];
  response: SearchResponse | undefined;
  onHover: (index: number) => void;
  onActivate: (index: number) => void;
  onPlay: (id: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecents: () => void;
}

const TITLES: Partial<Record<OmniboxSection, string>> = {
  top: "topResult",
  movies: "movies",
  series: "series",
  collections: "collections",
  people: "people",
  episodes: "episodes",
  facets: "facets",
  recent: "recent",
  resume: "continueWatching",
  genres: "browseGenres",
};

/** Le total d'une section, quand il dépasse ce qui est montré. */
function sectionTotal(section: OmniboxSection, response: SearchResponse | undefined): number | null {
  if (response === undefined) return null;
  if (section === "movies" || section === "series" || section === "collections" || section === "people") {
    return response.totals[section];
  }
  return null;
}

function OptionView({ option, row, terms, onPlay, onRemoveRecent }: {
  option: OmniboxOption;
  row: RowProps;
  terms: readonly string[];
  onPlay: (id: string) => void;
  onRemoveRecent: (query: string) => void;
}) {
  const { target } = option;
  switch (target.type) {
    case "item":
      return option.section === "top"
        ? <TopItemHit {...row} hit={target.hit} terms={terms} onPlay={onPlay} />
        : <ItemRow {...row} hit={target.hit} terms={terms} />;
    case "person":
      return option.section === "top"
        ? <TopPersonHit {...row} person={target.person} terms={terms} />
        : <PersonRow {...row} person={target.person} terms={terms} />;
    case "episode":
      return <EpisodeRow {...row} item={target.item} terms={terms} />;
    case "facet":
      // Sous « Parcourir par genre », l'étiquette « genre » serait redite.
      return <FacetChip {...row} facet={target.facet} kind={target.kind} showKind={option.section === "facets"} />;
    case "recent":
      return <RecentRow {...row} query={target.query} onRemove={onRemoveRecent} />;
    case "resume":
      return <ResumeRow {...row} item={target.item} />;
    case "external":
      return <ExternalRow {...row} item={target.item} terms={terms} />;
    case "all":
      return <AllResultsRow {...row} query={target.query} />;
  }
}

export const OmniboxList = memo(function OmniboxList({
  options, activeIndex, terms, response, onHover, onActivate, onPlay, onRemoveRecent, onClearRecents,
}: OmniboxListProps) {
  const { t } = useTranslation("search");
  const indexOf = new Map(options.map((option, index) => [option.key, index]));
  return (
    <>
      {groupBySection(options).map(({ section, key, options: group }) => {
        // Hors bibliothèque, le titre est celui du plugin (« Pas encore sur le serveur · via Vigie »).
        const first = group[0]?.target;
        const external = first?.type === "external" ? first.provider : null;
        const title = external !== null ? external.label : TITLES[section] ? t(TITLES[section] as string) : undefined;
        const total = sectionTotal(section, response);
        const chips = section === "facets" || section === "genres";
        return (
          <div key={key} role="group" aria-label={title} className={section === "all" ? "mt-1" : "mt-1.5 first:mt-0"}>
            {title && (
              <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-content-quaternary">
                  {title}
                  {external !== null && (
                    <span className="ml-1.5 font-medium normal-case tracking-normal">{t("externalBy", { name: external.source })}</span>
                  )}
                </span>
                {section === "recent" && (
                  <button type="button" tabIndex={-1} onClick={onClearRecents} className="text-[11px] font-medium text-content-tertiary transition-colors hover:text-content-primary">
                    {t("clearRecent")}
                  </button>
                )}
                {total !== null && total > group.length && (
                  <span className="text-[11px] tabular-nums text-content-quaternary">{total}</span>
                )}
              </div>
            )}
            <div className={chips ? "flex flex-wrap gap-2 px-3 pb-1" : "flex flex-col gap-0.5"}>
              {group.map((option) => {
                const index = indexOf.get(option.key) ?? 0;
                const row: RowProps = { index, active: index === activeIndex, onHover, onActivate };
                return (
                  <OptionView key={option.key} option={option} row={row} terms={terms} onPlay={onPlay} onRemoveRecent={onRemoveRecent} />
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
});
