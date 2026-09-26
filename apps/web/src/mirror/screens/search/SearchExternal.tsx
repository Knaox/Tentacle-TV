import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Film, Tv } from "lucide-react";
import type { ExternalSearchItem, ExternalSearchResult, ExternalTone, SearchProvider } from "@tentacle-tv/shared";
import { useGrid } from "../../useMirrorLayout";
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
                <ExternalCard key={item.id} item={item} width={cell} onPress={() => onOpen(result.provider, item)} />
              ))}
            </div>
          ) : (
            <Rail>
              {result.items.map((item) => (
                <ExternalCard key={item.id} item={item} width={railWidth} onPress={() => onOpen(result.provider, item)} />
              ))}
            </Rail>
          )}
        </section>
      ))}
    </>
  );
});

/** `ExternalCard` : affiche 2:3 à contour pointillé, pastille d'état, titre 13 et année 12. */
function ExternalCard({ item, width, onPress }: { item: ExternalSearchItem; width: number; onPress: () => void }) {
  const [broken, setBroken] = useState(false);
  const Icon = item.kind === "series" ? Tv : Film;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={[item.title, item.year, item.badge?.label].filter(Boolean).join(", ")}
      className="shrink-0 text-left active:opacity-70"
      style={{ width }}
    >
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-line-subtle bg-surface-2"
        style={{ width, height: width * 1.5 }}
      >
        {item.imageUrl && !broken ? (
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Icon size={26} className="text-content-quaternary" aria-hidden />
        )}
        {item.badge && <Badge label={item.badge.label} tone={item.badge.tone} />}
      </span>
      <span className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-4 text-content-primary">{item.title}</span>
      {item.year !== null && <span className="block text-xs text-content-tertiary">{item.year}</span>}
    </button>
  );
}

/** Les paires d'état du thème (`statusPairs` de l'app) ; `neutral` : pastille sombre. */
const TONE_CLASS: Record<ExternalTone, string> = {
  neutral: "text-on-media-primary",
  info: "bg-status-info-bg text-status-info-fg",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
};

/** La pastille d'état que le plugin pose sur un titre (« Demandé », « Bientôt »…). */
function Badge({ label, tone }: { label: string; tone: ExternalTone }) {
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 max-w-[88%] truncate rounded-full px-[7px] py-[3px] text-[10.5px] font-semibold ${TONE_CLASS[tone]}`}
      style={tone === "neutral" ? { background: "rgba(var(--scrim-media-rgb), 0.72)" } : undefined}
    >
      {label}
    </span>
  );
}
