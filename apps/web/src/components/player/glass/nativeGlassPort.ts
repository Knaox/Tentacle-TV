/**
 * LA couture entre le lecteur et les socles du verre — la seule.
 *
 *  - lg-tokens : le mode rendu (`data-liquid-glass`, `useLiquidGlassMode`) et
 *    la primitive des régions natives (`useLiquidGlassRegion`), qui suit le
 *    rectangle d'un élément image par image et regroupe les envois ;
 *  - lg-natif : les vues NSGlassEffectView derrière la page, et le pont
 *    (`window.tentacle.liquidGlass`) qui dit si le verre VOIT la vidéo, et
 *    mesure ce qu'il y a dessous (`sample`, lu par `useBackdropTone`).
 *
 * Le lecteur ne les appelle QUE d'ici : un changement de leur contrat se
 * répare en un seul endroit.
 */

import type { RefObject } from "react";
import { useBackdropTone, useLiquidGlassMode, useLiquidGlassRegion, type BackdropTone } from "../../../theme/glass";
import { nativeGlassBridge, nativeGlassRefractsVideo } from "../../../theme/liquidGlassMode";
import type { NativeGlassMaterialize } from "../../../desktop/types";

export interface GlassRegionOptions {
  /**
   * Visible : la région existe côté natif. Fausse, elle est RETIRÉE — ce qui
   * n'est pas affiché ne consomme rien (aucune vue native laissée derrière des
   * contrôles masqués).
   */
  active: boolean;
  /** Groupe de fusion : même conteneur natif, AppKit fond les verres qui se touchent. Absent : seule. */
  group: string | undefined;
  /** Distance (px CSS) sous laquelle les verres du groupe fusionnent ; absente : celle d'AppKit. */
  spacing?: number;
  /**
   * Apparition et disparition en FONDU NATIF, en ms (et déplacement animé
   * d'autant). Le contenu, lui, se pose sur son ressort CSS dans le même temps.
   */
  transition: number;
  /** `regular` : la matière par défaut ; `clear` : plus transparente. */
  variant: "regular" | "clear";
  /**
   * La matérialisation (`playerGlassMaterialize.ts`) : le verre monte et
   * s'allume avec son contenu. Sans `group` — son fondu est celui de SON conteneur.
   */
  materialize?: NativeGlassMaterialize;
}

/**
 * Le verre natif est-il rendu ici (macOS 26, réglage allumé) ? Suit le réglage
 * EN DIRECT : le couper pendant la lecture rend aussitôt l'habillage d'avant.
 */
export function useNativeGlassAvailable(): boolean {
  return useLiquidGlassMode() === "native";
}

/**
 * Le verre voit-il la vidéo ? Vrai pour le montage macOS `fenetre` (Apple
 * Silicon : la fenêtre Metal de mpv, SOUS la nôtre) — le socle le dit
 * (`refractsVideo`). Faux sur Intel (mpv dessine par OpenGL DANS notre
 * fenêtre) et partout où le pont ne le dit pas : l'habillage d'avant.
 *
 * ⚠️ `refractsVideo` traverse le pont par CHAÎNE (`desktop/types.ts`) : le
 * renommer côté preload rend, en silence, l'habillage d'avant.
 */
export function videoUnderWindow(): boolean {
  return nativeGlassRefractsVideo();
}

/**
 * Synchronise une région de verre natif avec l'élément `ref`.
 *
 * Le rayon vient du CSS de l'élément (`border-radius`, un jeton
 * `--lg-player-radius-*`), la teinte de `--lg-native-tint-*` que les feuilles
 * du lecteur redéfinissent sur leurs surfaces (`playerGlass.css`).
 */
export function useNativeGlassRegion(ref: RefObject<HTMLElement | null>, options: GlassRegionOptions): void {
  useLiquidGlassRegion(ref, {
    enabled: options.active,
    level: options.variant,
    shape: "rounded",
    group: options.group,
    spacing: options.spacing,
    transition: options.transition,
    materialize: options.materialize,
  });
}

/**
 * Le TON de ce qui est sous une forme du lecteur (`dark` | `light`), mesuré par
 * la coquille tant que `active` — relu au ralenti pendant la lecture, rien quand
 * les contrôles sont masqués. Sur la vidéo, le thème ne dit rien du dessous :
 * sans mesure, le ton reste `dark` (des glyphes clairs, comme avant).
 *
 * La mesure porte sur la VIDÉO SEULE sous la forme (`under: "window"`, lg-natif
 * `videoSample.ts` : l'image décodée de mpv, une par seconde au plus, hors du
 * fil principal), la page exclue : nos glyphes, chiffres et halos ne pèsent
 * rien — un ton qui se lirait sur eux oscillerait (des glyphes blancs lus
 * « clairs » passent au sombre, relus « sombres » repassent au clair).
 */
export function useVideoBackdropTone(element: HTMLElement | null, active: boolean): BackdropTone {
  return useBackdropTone(element, active && videoToneMeasurable(), { fallback: "dark", under: "window" });
}

/**
 * La coquille sait-elle mesurer la VIDÉO sous la page ? Au montage `fenetre`
 * (Apple Silicon : mpv dans sa fenêtre Metal, sous la nôtre), là où le lecteur
 * pose son verre. La branche de lg-natif qui l'apprend à `sample` (`6d86ce1ed`,
 * puis `under: "window"` en `aece229d4`) fait partie de celle-ci : la mesure
 * n'existe pas sans elle.
 */
export function videoToneMeasurable(): boolean {
  const bridge = nativeGlassBridge() as { sample?: unknown } | null;
  return typeof bridge?.sample === "function" && nativeGlassRefractsVideo();
}
