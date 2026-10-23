/**
 * Une barre d'actions qui FLOTTE (lot lg7, R2 et R16) — sélection multiple,
 * marquage « vu », suppression, ajout d'une liste partagée, « Pour vous »
 * prêt, « Nouveautés disponibles ».
 *
 * Verre natif (macOS 26) : comme la barre d'action d'une sélection de Photos
 * ou du Finder, des CAPSULES de verre détachées des bords — une par GROUPE
 * (HIG Toolbars : des groupes séparés, le contenu dessous donne la couleur).
 * Chaque groupe est une surface de la primitive au régime `control` : petite,
 * elle suit le TON du dessous (`data-lg-tone`, mesuré) et ses glyphes avec —
 * plus de texte blanc sur une affiche blanche. Dedans, de simples glyphes
 * (marqueurs `.lg-fb-btn`, `lgFloatingBar.css`) : jamais de verre dans le verre.
 *
 * Ailleurs : `legacy`, le balisage d'avant, rendu tel quel — le rendu d'avant
 * au pixel près ; `portal` le monte dans `document.body` comme avant. Le rendu
 * natif, `fixed`, y est TOUJOURS monté (sous un verre ou un `transform`, il
 * serait borné par lui : `modalPortal.test.ts`).
 *
 *     <FloatingBar portal legacy={<OldBar />} label="…" groups={[status, actions]} />
 */

import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLiquidGlassMode, useLiquidGlassSurface } from "../../../theme/glass";

interface FloatingBarProps {
  /** Le rendu d'avant, hors du verre natif. */
  legacy: ReactNode;
  /** Les groupes, une capsule de verre chacun (verre natif). */
  groups: ReadonlyArray<ReactNode>;
  /** Le bord où la barre flotte : en bas (défaut), ou sous la barre du haut. */
  edge?: "bottom" | "top";
  /** Monte AUSSI le rendu d'avant dans `document.body` (le natif y est toujours). */
  portal?: boolean;
  /** Rôle et nom accessibles de la barre (verre natif). */
  role?: "toolbar" | "status";
  label?: string;
  live?: "polite";
  /** Attributs `data-*` d'un banc ou d'une règle (verre natif). */
  data?: Record<`data-${string}`, string>;
}

const EDGE: Record<"bottom" | "top", CSSProperties> = {
  bottom: { bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" },
  // Sous la barre du haut (68 px), elle-même sous le bandeau des feux.
  top: { top: "calc(var(--hote-bandeau, 0px) + 76px)" },
};

export function FloatingBar({ legacy, groups, edge = "bottom", portal = false, role, label, live, data }: FloatingBarProps) {
  const native = useLiquidGlassMode() === "native";
  if (!native) return portal ? createPortal(legacy, document.body) : <>{legacy}</>;
  return createPortal(
    <>
      {/* L'effet de bord du bas : le contenu se fond sous la barre (lgFloatingBar.css). */}
      {edge === "bottom" && <div aria-hidden className="lg-floating-bar-edge" />}
      <div
        role={role}
        aria-label={label}
        aria-live={live}
        {...data}
        data-lg-edge={edge}
        className="lg-floating-bar pointer-events-none fixed inset-x-0 z-50 flex flex-wrap items-center justify-center gap-2.5 px-4"
        style={EDGE[edge]}
      >
        {groups.map((group, index) => (
          <FloatingBarGroup key={index}>{group}</FloatingBarGroup>
        ))}
      </div>
    </>,
    document.body,
  );
}

function FloatingBarGroup({ children }: { children: ReactNode }) {
  // Un PETIT verre : régime `control`, il bascule avec le ton du dessous.
  const glass = useLiquidGlassSurface({
    shape: "capsule",
    scale: "control",
    className: "lg-floating-bar-group pointer-events-auto flex min-h-12 items-center gap-1 px-1.5 py-1.5",
  });
  return (
    <div {...glass.props}>
      {glass.layers}
      {children}
    </div>
  );
}
