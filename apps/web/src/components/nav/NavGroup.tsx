/**
 * Un GROUPE de la barre du haut : une pilule de verre qui flotte sur la page (refonte de
 * nov. 2026 — la barre n'est plus une capsule d'un seul tenant, mais la navigation, la
 * recherche, les actions et le compte, chacun dans son verre).
 *
 * Même séparation qu'avant, par groupe (`theme/chrome.css`) : la couche de VERRE porte le flou
 * et ne change jamais ; la couche d'ASSISE, par-dessus, ne fait varier que son opacité au
 * défilement — nulle en haut de page, puis jusqu'à 0,78. Plus petits que l'ancienne capsule,
 * les groupes floutent moins de pixels qu'elle.
 *
 * `lgc-capsule` : sous le verre de macOS 26, chaque groupe prend la peau de la maquette par la
 * règle déjà écrite pour la capsule (`desktop/windowGlassNav.css`) — le verre change le
 * MATÉRIAU, jamais les DIMENSIONS. `data-hote-voile` : le voile des greffons vise chaque groupe.
 */

import type { ReactNode, Ref } from "react";

import { useScrollScrim } from "./useScrollScrim";

interface NavGroupProps {
  children: ReactNode;
  /** La mise en page du groupe dans la barre (largeur, rétrécissement). */
  className?: string;
  /** La mise en page de son contenu. */
  contentClassName?: string;
  ref?: Ref<HTMLDivElement>;
}

export function NavGroup({ children, className = "", contentClassName = "gap-0.5 px-1", ref }: NavGroupProps) {
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 140,
    opacityAt: (p) => Math.min(0.78, p * 0.95),
  });
  return (
    <div
      ref={ref}
      data-hote-voile="topbar"
      className={`lgc-capsule pointer-events-auto relative h-[46px] rounded-pill ${className}`}
    >
      <div aria-hidden className="nav-capsule-glass" />
      <div ref={scrim.ref} aria-hidden className="nav-capsule-scrim" />
      <div className={`relative flex h-full min-w-0 items-center ${contentClassName}`}>{children}</div>
    </div>
  );
}
