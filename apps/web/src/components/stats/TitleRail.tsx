import { memo } from "react";
import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import { CardImage } from "../cards/CardImage";

export interface RailTitle {
  key: string;
  /** Fiche à ouvrir ; null pour un titre qu'on ne sait pas ouvrir. */
  href: string | null;
  /** À défaut de lien : une ouverture calculée (fiche catalogue Vigie). */
  onOpen?: () => void;
  title: string;
  caption: string;
  /** Pastille sous le titre (« Vu 2 fois », « Coup de cœur »). */
  chip?: string;
  imageUrl: string;
}

interface TitleRailProps {
  items: RailTitle[];
  ariaLabel: string;
  /** Rang en grands chiffres détourés à gauche de l'affiche (« Top »). */
  ranked?: boolean;
}

const POSTER = "w-[118px] sm:w-[136px] md:w-[148px]";

/**
 * Une rangée d'affiches qui défile à l'horizontale : le titre, une légende
 * (épisodes et durée, date de visionnage) et, pour un classement, le rang en
 * grands chiffres détourés, calé sur le bas de l'AFFICHE (une grille à deux
 * rangées : l'affiche, puis le texte). Les cartes s'alignent par le haut : un
 * titre sur deux lignes ne décale pas son affiche.
 */
export const TitleRail = memo(function TitleRail({ items, ariaLabel, ranked }: TitleRailProps) {
  return (
    <ul aria-label={ariaLabel} className="-mx-1 flex snap-x items-start gap-4 overflow-x-auto overflow-y-hidden px-1 pb-3 pt-1">
      {items.map((item, index) => (
        <li key={item.key} className="shrink-0 snap-start">
          <RailCard item={item} rank={ranked ? index + 1 : undefined} />
        </li>
      ))}
    </ul>
  );
});

const RailCard = memo(function RailCard({ item, rank }: { item: RailTitle; rank?: number }) {
  const body = (
    <>
      {rank !== undefined && (
        <span
          aria-hidden
          className="col-start-1 row-start-1 -mr-2.5 select-none self-end text-[64px] font-black leading-[0.78] tabular-nums md:text-[80px]"
          style={{ color: "transparent", WebkitTextStroke: "2px rgba(var(--brand-rgb), 0.85)" }}
        >
          {rank}
        </span>
      )}
      <span className={`relative col-start-2 row-start-1 block aspect-[2/3] ${POSTER} overflow-hidden rounded-xl bg-fill-soft ring-1 ring-line-subtle`}>
        <CardImage
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          fallback={<span className="flex h-full w-full items-center justify-center text-content-disabled"><Film size={28} aria-hidden /></span>}
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-fill-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </span>
      <span className={`col-start-2 row-start-2 block ${POSTER}`}>
        <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-snug text-content-primary">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs tabular-nums text-content-tertiary">{item.caption}</span>
        {item.chip && (
          <span className="mt-1.5 inline-flex rounded-full bg-[rgba(var(--brand-rgb),0.14)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-light)]">
            {item.chip}
          </span>
        )}
      </span>
    </>
  );
  const className = "group grid grid-cols-[auto_auto] rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-0)]";
  const label = `${item.title}, ${item.caption}`;
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
  return <div className={className}>{body}</div>;
});
