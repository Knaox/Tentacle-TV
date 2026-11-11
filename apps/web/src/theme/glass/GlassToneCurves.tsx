/**
 * Les COURBES DE TONS du verre givré posé sur une image (`.lg-content-frosted`) : deux filtres
 * SVG, montés UNE fois près de la racine, que la feuille référence par `--lg-frost-curve`
 * (`backdrop-filter: blur(…) saturate(…) url(#…)`). Le pourquoi et la preuve : `frostedMaterial.ts`.
 *
 * `color-interpolation-filters="sRGB"` : par défaut un filtre SVG calcule en RVB linéaire, et la
 * table ne plafonnerait plus là où le test le prouve. Un `feComponentTransfer` n'est qu'une table
 * de couleurs dans la passe de givre que le panneau avait déjà : ni carte de déplacement, ni image
 * — ce n'est pas une lentille (`gpuBudget.ts` ne la compte pas).
 *
 * Hors du mode natif, RIEN n'est rendu : aucune règle ne lit ces filtres.
 */

import { memo } from "react";
import { useLiquidGlassMode } from "../useLiquidGlass";
import { FROST_CURVE, FROST_CURVE_ID } from "./frostedMaterial";

const TONES = ["dark", "light"] as const;

export const GlassToneCurves = memo(function GlassToneCurves() {
  if (useLiquidGlassMode() !== "native") return null;
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
      <defs>
        {TONES.map((tone) => {
          const table = FROST_CURVE[tone].join(" ");
          return (
            <filter key={tone} id={FROST_CURVE_ID[tone]} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues={table} />
                <feFuncG type="table" tableValues={table} />
                <feFuncB type="table" tableValues={table} />
              </feComponentTransfer>
            </filter>
          );
        })}
      </defs>
    </svg>
  );
});
