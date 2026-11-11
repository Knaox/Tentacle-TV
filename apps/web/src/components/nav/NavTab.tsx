/**
 * Un onglet de la barre : une pilule au LIBELLÉ seul (refonte de nov. 2026 — le
 * prototype validé ; l'icône de la destination reste dans « Plus » et dans
 * « Personnaliser la barre », où une liste se parcourt), et, pour l'onglet
 * courant, une pastille NEUTRE qui GLISSE d'un onglet à l'autre (le segmented
 * control d'iOS) — sur le compositeur (`SlidingMarker`), avec ou sans verre.
 *
 * `NavTabBody` est le même dessin sans lien ni indicateur : c'est lui que la
 * rangée fantôme mesure (`usePriorityOverflow`). Il est rendu en gras, la
 * largeur de l'onglet actif : un onglet ne doit jamais déborder en devenant
 * courant.
 *
 * Un clic droit (ou la touche Menu) ouvre le menu de la barre (`onMenu`) :
 * retirer l'onglet, personnaliser la barre.
 */

/** Où ouvrir un menu contextuel : au pointeur, ou — ouvert au clavier — sous l'élément. */
export function menuAnchor(event: MouseEvent<HTMLElement>): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY };
  const box = event.currentTarget.getBoundingClientRect();
  return { x: box.left, y: box.bottom + 6 };
}

import { memo, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { GLASS_LENS_PROPS } from "../../theme/glass";
import { SlidingMarker } from "../ui/SlidingMarker";
import type { NavIcon } from "./useNavDestinations";

export const TAB_CLASS =
  "lgc-tab group relative flex h-[38px] shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm outline-none transition-colors duration-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus";

export function ActiveIndicator({ reduced }: { reduced: boolean }) {
  // Les jetons de la lentille (`windowGlass.css`) n'existent qu'en mode natif (la pastille neutre
  // de la barre d'onglets d'iOS 26) — ailleurs, le repli est le dessin d'avant.
  const paint = {
    background: "var(--lg-chrome-lens-bg, var(--nav-active-bg))",
    boxShadow: "var(--lg-chrome-lens-shadow, inset 0 0 0 1px var(--nav-active-ring))",
  };
  // UN glissement, avec ou sans verre : sur le compositeur (`SlidingMarker`), mesuré dans la
  // FENÊTRE. Sous le verre natif il passait par la métamorphose de framer (`layoutId`), qui mesure
  // dans la PAGE : changer d'onglet après avoir défilé remet la page en haut, et la pastille
  // partait en DIAGONALE, du défilement quitté vers sa place (nov. 2026) — en perdant des images,
  // la page suivante se rendant sur le même fil.
  return <SlidingMarker group="nav-active" still={reduced} className="lgc-lens absolute inset-0 rounded-pill" style={paint} />;
}

export function TabIcon({ icon: Icon, active }: { icon: NavIcon; active: boolean }) {
  return (
    <Icon
      aria-hidden
      weight={active ? "fill" : "regular"}
      className={`relative h-[17px] w-[17px] shrink-0 transition-colors duration-hover ${
        active ? "text-accent" : "text-content-tertiary group-hover:text-content-secondary"
      }`}
    />
  );
}

export function tabTone(active: boolean): string {
  return active
    ? "font-semibold text-content-primary"
    : "font-semibold text-content-secondary hover:bg-fill-subtle hover:text-content-primary";
}

export const NavTab = memo(function NavTab({ id, label, path, icon, active, reduced, onIntent, onMenu }: {
  /** La clé de la destination — ce que le menu retire. */
  id?: string;
  label: string;
  path: string;
  /** Dessinée quand elle est donnée (les deux onglets du mode hors ligne) ; la barre en ligne n'en passe pas. */
  icon?: NavIcon;
  active: boolean;
  reduced: boolean;
  /** Survol ou focus : l'intention d'y aller (préchargement). */
  onIntent?: () => void;
  onMenu?: (anchor: { x: number; y: number }, key: string, label: string) => void;
}) {
  return (
    <Link
      to={path}
      // La lentille du verre au survol et à l'appui (CSS seul, mode natif).
      {...GLASS_LENS_PROPS}
      aria-current={active ? "page" : undefined}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      onContextMenu={onMenu && id !== undefined ? (event) => {
        event.preventDefault();
        onMenu(menuAnchor(event), id, label);
      } : undefined}
      className={`${TAB_CLASS} ${tabTone(active)}`}
    >
      {active && <ActiveIndicator reduced={reduced} />}
      {icon && <TabIcon icon={icon} active={active} />}
      <span className="relative whitespace-nowrap">{label}</span>
    </Link>
  );
});

/** Le dessin d'un onglet, pour la mesure — jamais affiché. */
export function NavTabBody({ label, leading, trailing }: { label: string; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <span className={`${TAB_CLASS} font-semibold`}>
      {leading}
      <span className="whitespace-nowrap">{label}</span>
      {trailing}
    </span>
  );
}
