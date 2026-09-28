import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { ExternalSearchItem, ExternalSearchResult, SearchProvider } from "@tentacle-tv/shared";
import { useGrid } from "../../useMirrorLayout";
import { ExternalResultCard } from "./ExternalResultCard";
import { Rail, gridCell, useRailCardWidth } from "./SearchSection";

interface Props {
  results: ExternalSearchResult[];
  onOpen: (provider: SearchProvider, item: ExternalSearchItem) => void;
  onSeeAll: (provider: SearchProvider, href: string) => void;
  /** `rail` dans les résultats ; `grid` sous une filmographie, dans la suite de sa grille. */
  layout?: "rail" | "grid";
}

/**
 * `ExternalSections` de l'app — ce que les extensions trouvent HORS de la
 * bibliothèque, une section par plugin : titre 17 gras (le nom qu'il a
 * choisi), « via Vigie » 12 dessous, « Tout voir sur Vigie » 13 violet clair
 * (170 max). Rail d'affiches 112 / 140, ou grille 3 colonnes gouttière 12.
 */
export const ExternalSections = memo(function ExternalSections({ results, onOpen, onSeeAll, layout = "rail" }: Props) {
  const { t } = useTranslation("search");
  const railWidth = useRailCardWidth();
  const grid = useGrid({ phoneColumns: 3, gutter: 12 });
  const cell = gridCell(grid.itemWidth);

  return (
    <>
      {results.map((result) => (
        <section key={result.provider.pluginId} className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2 px-4">
            <div className="min-w-0 shrink">
              <h2 className="text-[17px] font-bold tracking-[-0.2px] text-content-primary">{result.provider.label}</h2>
              <p className="mt-px text-xs font-medium text-content-tertiary">{t("externalBy", { name: result.provider.source })}</p>
            </div>
            {result.moreHref && (
              <button
                type="button"
                onClick={() => onSeeAll(result.provider, result.moreHref as string)}
                className="flex min-h-8 max-w-[170px] items-center gap-0.5 text-[13px] font-semibold text-brand-light"
              >
                <span className="truncate">{t("externalSeeAll", { name: result.provider.source })}</span>
                <ChevronRight size={15} className="shrink-0" aria-hidden />
              </button>
            )}
          </div>
          {layout === "grid" ? (
            <div className="flex flex-wrap" style={{ paddingInline: grid.padding, columnGap: grid.gutter, rowGap: 12 }}>
              {result.items.map((item) => (
                <ExternalResultCard key={item.id} item={item} width={cell} onPress={() => onOpen(result.provider, item)} />
              ))}
            </div>
          ) : (
            <Rail>
              {result.items.map((item) => (
                <ExternalResultCard key={item.id} item={item} width={railWidth} onPress={() => onOpen(result.provider, item)} />
              ))}
            </Rail>
          )}
        </section>
      ))}
    </>
  );
});
