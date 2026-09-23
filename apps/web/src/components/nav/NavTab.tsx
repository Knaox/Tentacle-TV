/**
 * Un onglet de la barre : icône ET libellé (une icône seule ne se devine pas),
 * et, pour l'onglet courant, un indicateur au dégradé de la marque qui GLISSE
 * d'un onglet à l'autre (`layoutId` partagé — le segmented control d'iOS).
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
import { motion } from "framer-motion";
import { springSoft } from "../../theme/motion";
import type { NavIcon } from "./useNavDestinations";

export const TAB_CLASS =
  "group relative flex h-9 shrink-0 items-center gap-2 rounded-[11px] px-3 text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus";

export function ActiveIndicator({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      layoutId="nav-active"
      aria-hidden
      className="absolute inset-0 rounded-[11px]"
      style={{ background: "var(--nav-active-bg)", boxShadow: "inset 0 0 0 1px var(--nav-active-ring)" }}
      transition={reduced ? { duration: 0 } : springSoft}
    />
  );
}

export function TabIcon({ icon: Icon, active }: { icon: NavIcon; active: boolean }) {
  return (
    <Icon
      aria-hidden
      strokeWidth={active ? 2.2 : 1.9}
      className={`relative h-[17px] w-[17px] shrink-0 transition-colors duration-150 ${
        active ? "text-[var(--brand-light)]" : "text-content-quaternary group-hover:text-content-secondary"
      }`}
    />
  );
}

export function tabTone(active: boolean): string {
  return active
    ? "font-semibold text-content-primary"
    : "font-medium text-content-tertiary hover:bg-fill-subtle hover:text-content-primary";
}

export const NavTab = memo(function NavTab({ id, label, path, icon, active, reduced, onIntent, onMenu }: {
  /** La clé de la destination — ce que le menu retire. */
  id?: string;
  label: string;
  path: string;
  icon: NavIcon;
  active: boolean;
  reduced: boolean;
  /** Survol ou focus : l'intention d'y aller (préchargement). */
  onIntent?: () => void;
  onMenu?: (anchor: { x: number; y: number }, key: string, label: string) => void;
}) {
  return (
    <Link
      to={path}
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
      <TabIcon icon={icon} active={active} />
      <span className="relative whitespace-nowrap">{label}</span>
    </Link>
  );
});

/** Le dessin d'un onglet, pour la mesure — jamais affiché. */
export function NavTabBody({ label, icon: Icon, trailing }: { label: string; icon: NavIcon; trailing?: ReactNode }) {
  return (
    <span className={`${TAB_CLASS} font-semibold`}>
      <Icon aria-hidden className="h-[17px] w-[17px] shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
      {trailing}
    </span>
  );
}
