import type { ReactNode } from "react";
import { HEADER_TOTAL } from "../shell/metrics";

/**
 * `SubtleBackground` de l'app (option `ambient`) : l'orbe violet de 320 qui
 * descend du HAUT DE L'ÉCRAN (0,18 → 0,04 → transparent à 0 / 30 / 70 %),
 * derrière l'en-tête de verre. Le contenu part sous l'en-tête (la coquille
 * pose ce décalage) : l'orbe remonte donc de `HEADER_TOTAL`. Il est peint
 * SOUS le contenu (`isolate` + `z-index: -1`) et ne s'anime pas. Le dégradé
 * `s0 → s0Tint` de l'app (noir → #070710) est laissé au fond de la coquille :
 * l'écart ne se voit pas, et un calque plein écran de plus coûterait.
 */
export function SubtleBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -z-10 h-80"
        style={{
          top: `calc(-1 * ${HEADER_TOTAL})`,
          background: "linear-gradient(180deg, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
