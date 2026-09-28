import { memo } from "react";
import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import { CardImage } from "../cards/CardImage";
import { ReasonChips, type ReasonChip } from "./ReasonChips";

export interface RailTitle {
  key: string;
  /** Fiche à ouvrir ; null pour un titre qu'on ne sait pas ouvrir. */
  href: string | null;
  /** À défaut de lien : une ouverture calculée (fiche catalogue Vigie). */
  onOpen?: () => void;
  title: string;
  caption: string;
  /** Les avis du titre (note, coup de cœur, favori…), sous la légende. */
  chips?: ReasonChip[];
  imageUrl: string;
}

interface TitleRailProps {
  items: RailTitle[];
  ariaLabel: string;
  /** Rang du premier titre, pour un classement ; absent : pas de rang. */
  firstRank?: number;
}

const POSTER = "w-[118px] sm:w-[132px] md:w-[144px]";

/**
 * Une rangée d'affiches qui défile à l'horizontale : le titre, une légende
 * (épisodes et durée, visionnages) et ses avis. Pour un classement, le rang
 * est une petite pastille posée sur l'affiche — un repère, pas un chiffre
 * géant. Les cartes s'alignent par le haut : un titre sur deux lignes ne
 * décale pas son affiche.
 */
export const TitleRail = memo(function TitleRail({ items, ariaLabel, firstRank }: TitleRailProps) {
  return (
    <ul aria-label={ariaLabel} className="-mx-1 flex snap-x items-start gap-4 overflow-x-auto overflow-y-hidden px-1 pb-3 pt-1">
      {items.map((item, index) => (
        <li key={item.key} className="shrink-0 snap-start">
          <RailCard item={item} rank={firstRank !== undefined ? firstRank + index : undefined} />
        </li>
      ))}
    </ul>
  );
});

const RailCard = memo(function RailCard({ item, rank }: { item: RailTitle; rank?: number }) {
  const body = (
    <>
      <span className={`relative block aspect-[2/3] ${POSTER} overflow-hidden rounded-xl bg-fill-soft ring-1 ring-line-subtle`}>
        <CardImage
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          fallback={<span className="flex h-full w-full items-center justify-center text-content-disabled"><Film size={28} aria-hidden /></span>}
        />
        {rank !== undefined && (
          <span
            aria-hidden
            className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md border border-white/20 bg-black/70 px-1.5 text-xs font-semibold tabular-nums text-white"
          >
            {rank}
          </span>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-fill-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </span>
      <span className={`block ${POSTER}`}>
        <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-snug text-content-primary">{item.title}</span>
        {item.caption && <span className="mt-0.5 block truncate text-xs tabular-nums text-content-tertiary">{item.caption}</span>}
        {item.chips && item.chips.length > 0 && <ReasonChips chips={item.chips} className="mt-1.5" />}
      </span>
    </>
  );
  const className = "group block rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-0)]";
  const label = [rank !== undefined ? `${rank}.` : null, item.title, item.caption, ...(item.chips ?? []).map((c) => c.ariaLabel ?? c.label)]
    .filter(Boolean)
    .join(", ");
  if (item.href) {
    return (
      <Link to={item.href} className={`${className} cursor-pointer`} aria-label={label}>
        {body}
      </Link>
    );
  }
  if (item.onOpen) {
    return (
      <button type="button" onClick={item.onOpen} className={`${className} cursor-pointer`} aria-label={label}>
        {body}
      </button>
    );
  }
  return <div className={className} aria-label={label}>{body}</div>;
});
