/**
 * LA couture entre le lecteur et les socles du verre — la seule.
 *
 * Deux sessions du lot posent ce que le lecteur consomme :
 *  - lg-natif : les vues NSGlassEffectView derrière la page, et le pont
 *    preload qui dit si la coquille sait en poser ;
 *  - lg-tokens : la primitive React (`useLiquidGlassRegion` / `<LiquidGlass>`)
 *    qui synchronise une région native avec un élément du DOM.
 *
 * Le lecteur ne les appelle QUE d'ici. Tant qu'ils ne sont pas branchés, le
 * verre natif est « indisponible » : la porte (`playerGlassMode.ts`) rend alors
 * l'habillage d'avant, au pixel près — aucune régression possible en chemin.
 *
 * ⚠️ Les noms lus sur `window.tentacle` traversent le pont par CHAÎNE : les
 * renommer côté preload casse ce module en silence (il répond « indisponible »).
 */

import type { RefObject } from "react";

export interface GlassRegionOptions {
  /**
   * Visible : la région existe côté natif. Fausse, elle est RETIRÉE — ce qui
   * n'est pas affiché ne consomme rien (aucune vue native laissée derrière des
   * contrôles masqués).
   */
  active: boolean;
  /**
   * Groupe de fusion : les régions d'un même groupe partagent un conteneur
   * natif, et AppKit fond celles qui se touchent.
   */
  group: string;
  /** `regular` : la matière par défaut ; `clear` : plus transparente. */
  variant: "regular" | "clear";
}

/** La coquille sait-elle poser du verre natif ici (macOS 26, module chargé) ? */
export function useNativeGlassAvailable(): boolean {
  // Branché à la fusion de lg-natif / lg-tokens.
  return false;
}

/**
 * La vidéo est-elle dans une fenêtre SOUS la nôtre ?
 *
 * Vrai pour le montage macOS `fenetre` (Apple Silicon : la fenêtre Metal de
 * mpv). Faux pour le montage `gl` (Intel : la vidéo est dessinée DANS notre
 * fenêtre), et partout où le pont ne le dit pas.
 */
export function videoUnderWindow(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = window.tentacle as { videoMontage?: unknown } | undefined;
  return bridge?.videoMontage === "fenetre";
}

/**
 * Synchronise une région de verre natif avec l'élément `ref`.
 *
 * Le rayon vient du CSS de l'élément (`border-radius`, un jeton
 * `--lg-player-radius-*`) : une seule source, lue par la primitive.
 */
export function useNativeGlassRegion(
  _ref: RefObject<HTMLElement | null>,
  _options: GlassRegionOptions,
): void {
  // Branché à la fusion de lg-natif / lg-tokens.
}
