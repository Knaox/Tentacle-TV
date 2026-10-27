/**
 * La MATÉRIALISATION des formes du lecteur en verre (lot lg8) — à la place de
 * la métamorphose en goutte, jugée « vraiment moche » : le geste du lecteur de
 * tvOS 26. Le verre « se condense » : chaque forme monte de quelques points en
 * grandissant à peine pendant que son verre s'allume, légèrement après la
 * précédente ; elle part plus vite, d'un seul geste, sans décalage.
 *
 * UNE source pour les deux moitiés : ces nombres vont à la coquille
 * (`materialize` d'une région, joué par l'animateur d'AppKit sur le verre et le
 * fondu de son conteneur) ET aux variables CSS de la surface (joué par la page
 * sur ce qu'elle dessine dans la forme, `playerGlassMaterialize.css`). Mêmes
 * durées, mêmes Béziers, même départ : le verre et son contenu ne divergent pas.
 *
 * Mouvement réduit : un fondu simple — ni montée, ni échelle, ni décalage.
 */

import type { CSSProperties } from "react";
import type { NativeGlassEase, NativeGlassMaterialize } from "../../../desktop/types";

/** Le geste, d'un seul tenant. */
export interface MaterializeMotion {
  enterMs: number;
  exitMs: number;
  staggerMs: number;
  /** Px CSS : la forme part d'autant plus bas. */
  rise: number;
  scale: number;
}

/**
 * Entrée 340 ms, très amortie (la forme se pose sans rebond : le verre natif ne
 * suit pas un dépassement, § 2.5) ; sortie 180 ms, qui accélère ; 30 ms entre
 * deux formes ; 6 px de montée, 96 % au départ.
 */
export const MATERIALIZE: MaterializeMotion = { enterMs: 340, exitMs: 180, staggerMs: 30, rise: 6, scale: 0.96 };

/** Un popover naît de son bouton : il part de plus près (88 %), de plus bas. */
export const MATERIALIZE_POPOVER: MaterializeMotion = { ...MATERIALIZE, rise: 10, scale: 0.88 };

/** Mouvement réduit : un fondu, rien d'autre. */
export const MATERIALIZE_REDUCED: MaterializeMotion = { enterMs: 200, exitMs: 150, staggerMs: 0, rise: 0, scale: 1 };

/** Entrée : décélération longue (la forme « se pose »). Sortie : accélération. */
export const MATERIALIZE_ENTER_EASE: NativeGlassEase = [0.2, 0.9, 0.3, 1];
export const MATERIALIZE_EXIT_EASE: NativeGlassEase = [0.4, 0, 1, 1];

/** L'origine de l'échelle, en fractions de la forme (0..1 depuis la gauche et le HAUT). */
export interface MaterializeOrigin {
  x: number;
  y: number;
}

export const CENTER_ORIGIN: MaterializeOrigin = { x: 0.5, y: 0.5 };

/** Ce que la coquille reçoit : le geste de la forme d'ordre `order`. */
export function nativeMaterialize(motion: MaterializeMotion, order: number, origin: MaterializeOrigin): NativeGlassMaterialize {
  return {
    rise: motion.rise,
    scale: motion.scale,
    originX: clamp01(origin.x),
    originY: clamp01(origin.y),
    delay: Math.max(0, order) * motion.staggerMs,
    exit: motion.exitMs,
    enterEase: MATERIALIZE_ENTER_EASE,
    exitEase: MATERIALIZE_EXIT_EASE,
  };
}

/**
 * Les variables CSS de la surface — le même geste, pour la page.
 * `originCss` remplace l'origine en fractions quand la page la connaît mieux
 * (un popover : à tant de px du bord droit, avant même sa mise en page).
 */
export function materializeStyle(native: NativeGlassMaterialize, enterMs: number, originCss?: string): CSSProperties {
  return {
    "--lgp-mat-rise": `${String(native.rise)}px`,
    "--lgp-mat-scale": String(native.scale),
    "--lgp-mat-origin": originCss ?? `${pct(native.originX)} ${pct(native.originY)}`,
    "--lgp-mat-delay": `${String(native.delay)}ms`,
    "--lgp-mat-enter-ms": `${String(enterMs)}ms`,
    "--lgp-mat-exit-ms": `${String(native.exit)}ms`,
    "--lgp-mat-enter-ease": bezier(native.enterEase),
    "--lgp-mat-exit-ease": bezier(native.exitEase),
  } as CSSProperties;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
const pct = (value: number): string => `${String(Math.round(value * 10000) / 100)}%`;
const bezier = (ease: NativeGlassEase): string => `cubic-bezier(${ease.join(", ")})`;
