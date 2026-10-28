/**
 * Octave — la mise en page de la coquille, selon l'appareil. Règle PURE : le
 * gabarit vient du miroir (`mirror/formFactor.ts` : téléphone, tablette ou
 * bureau), l'orientation de la fenêtre.
 *
 * - `phone` : en-tête, page, mini-lecteur et onglets FLOTTANTS (la grammaire de
 *   l'app mobile : `apps/mobile`, et du miroir du web étroit).
 * - `tablet-rail` : tablette en portrait — un rail d'icônes à gauche, le dock
 *   en bas ; jamais un téléphone étiré.
 * - `tablet-wide` : tablette en paysage — la coquille du bureau (barre latérale,
 *   dock), la file en tiroir PAR-DESSUS la page (pas une colonne de plus).
 * - `desktop` : rien ne change.
 *
 * L'application de bureau (Electron) est toujours « bureau » pour le miroir ;
 * une fenêtre étroite y garde le téléphone d'Octave d'avant (`narrowWindow`).
 */

import type { FormFactor } from "../../../../mirror/formFactor";

export type OctaveLayout = "phone" | "tablet-rail" | "tablet-wide" | "desktop";

export interface OctaveLayoutFacts {
  formFactor: FormFactor;
  landscape: boolean;
  /** Fenêtre de 768 px ou moins (`useIsMobile`) : le téléphone d'Octave d'avant. */
  narrowWindow: boolean;
}

export function resolveOctaveLayout(f: OctaveLayoutFacts): OctaveLayout {
  if (f.formFactor === "phone") return "phone";
  if (f.formFactor === "tablet") return f.landscape ? "tablet-wide" : "tablet-rail";
  return f.narrowWindow ? "phone" : "desktop";
}

/** Une tablette : cibles au doigt, file en tiroir. */
export function isTabletLayout(layout: OctaveLayout): boolean {
  return layout === "tablet-rail" || layout === "tablet-wide";
}
