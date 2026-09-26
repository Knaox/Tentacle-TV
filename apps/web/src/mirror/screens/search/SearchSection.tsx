import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { MediaItem, SearchItemHit, SearchMediaItem } from "@tentacle-tv/shared";
import { MediaCard } from "../../cards/MediaCard";
import { useGrid, useIsTablet } from "../../useMirrorLayout";

/** Largeur d'une affiche dans un rail de résultats (téléphone 112 / tablette 140). */
export function useRailCardWidth(): number {
  return useIsTablet() ? 140 : 112;
}

/** Un résultat de recherche est un `MediaItem` réduit : la carte n'en lit que ce qu'il porte. */
export const asMediaItem = (item: SearchMediaItem): MediaItem => item as unknown as MediaItem;

/**
 * `SectionHeader` de l'app : titre 17 gras (-0,2), compte 13 tertiaire accolé,
 * « Tout voir » 13 violet clair à chevron 15 ; 16 de marge, 8 dessous.
 */
export function SectionHeader({ title, count, onSeeAll }: { title: string; count?: number; onSeeAll?: () => void }) {
  const { t } = useTranslation("search");
  return (
    <div className="mb-2 flex items-center justify-between px-4">
      <h2 className="text-[17px] font-bold tracking-[-0.2px] text-content-primary">
        {title}
        {count !== undefined && count > 0 && (
          <span className="whitespace-pre text-[13px] font-medium text-content-tertiary">{`  ${count}`}</span>
        )}
      </h2>
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="flex min-h-8 items-center gap-0.5 text-[13px] font-semibold text-brand-light">
          {t("seeAll")}
          <ChevronRight size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** `Section` de l'app : 16 au-dessus, son en-tête, puis son contenu. */
export function Section({ children, ...header }: { title: string; count?: number; onSeeAll?: () => void; children: ReactNode }) {
  return (
    <section className="mt-4">
      <SectionHeader {...header} />
      {children}
    </section>
  );
}

/** Un rail horizontal de l'app : 16 de marge, 12 entre les cartes, sans barre. */
export function Rail({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="mirror-no-scrollbar flex overflow-x-auto px-4" style={{ gap }}>
      {children}
    </div>
  );
}

/** `PosterRail` : l'aperçu d'une catégorie dans « Tout », affiches 112 / 140. */
export const PosterRail = memo(function PosterRail({ hits, onOpen }: { hits: SearchItemHit[]; onOpen: (id: string) => void }) {
  const width = useRailCardWidth();
  return (
    <Rail>
      {hits.map((hit) => (
        <div key={hit.item.Id} className="shrink-0">
          <MediaCard item={asMediaItem(hit.item)} width={width} onPress={() => onOpen(hit.item.Id)} />
        </div>
      ))}
    </Rail>
  );
});

/**
 * La largeur d'une cellule de grille, arrondie AU-DESSOUS au 1/64 de pixel (le
 * pas de mise en page des navigateurs) : arrondie au-dessus, la dernière
 * colonne passerait à la ligne.
 */
export function gridCell(itemWidth: number): number {
  return Math.floor(itemWidth * 64) / 64;
}

/** Une catégorie entière en grille — `useGrid({ phoneColumns: 3, gutter: 12 })` de l'app. */
export const PosterGrid = memo(function PosterGrid({ hits, onOpen, className }: {
  hits: SearchItemHit[];
  onOpen: (id: string) => void;
  className?: string;
}) {
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3, gutter: 12 });
  const cell = gridCell(itemWidth);
  return (
    <div className={`flex flex-wrap ${className ?? ""}`} style={{ paddingInline: padding, gap: gutter }}>
      {hits.map((hit) => (
        <div key={hit.item.Id} style={{ width: cell }}>
          <MediaCard item={asMediaItem(hit.item)} width={cell} onPress={() => onOpen(hit.item.Id)} />
        </div>
      ))}
    </div>
  );
});
