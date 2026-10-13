import type { CSSProperties } from "react";
import { PREVIEW_ENGINE_EXIT_MS } from "./engine";

/**
 * Le tempo de la mini-carte — UNE source, lue par la feuille (variables CSS
 * posées sur la mini-carte) et par le crochet (la lecture attend la fin de
 * l'agrandissement).
 *
 * ENTRÉE, 340 ms en décélération (`--ease-out`) : la mini-carte part de la
 * carte, à son échelle et à sa place, et grandit vers la sienne. Son opacité
 * monte en 140 ms seulement — c'est le fondu croisé avec la carte, qui
 * s'efface dessous — : ce qu'on voit grandir, c'est déjà la vidéo, arrêtée
 * sur sa première image. Elle démarre une fois la mini-carte posée.
 *
 * Le groupe du survol (étoiles, plateau), le titre et le bouton du son
 * montent quand la mini-carte arrive (160 ms de retard) : rien ne s'écrit sur
 * une boîte encore en mouvement.
 *
 * SORTIE, 220 ms en accélération : plus courte que l'entrée (≈ 65 %, la règle
 * de `theme/motion.ts`), elle rend la mini-carte à sa carte — et finit avant
 * que le moteur ne démonte la vidéo (`PREVIEW_ENGINE_EXIT_MS`).
 *
 * Animations RÉDUITES : un simple fondu de 180 ms, sans échelle ni
 * déplacement, dans les deux sens.
 */
export const PREVIEW_ENTER_MS = 340;
export const PREVIEW_ENTER_FADE_MS = 140;
export const PREVIEW_CONTENT_DELAY_MS = 160;
export const PREVIEW_EXIT_MS = Math.min(220, PREVIEW_ENGINE_EXIT_MS - 20);
export const PREVIEW_REDUCED_FADE_MS = 180;

/** Le temps au bout duquel la mini-carte est posée : la lecture peut partir. */
export function previewSettleMs(reduced: boolean): number {
  return reduced ? PREVIEW_REDUCED_FADE_MS : PREVIEW_ENTER_MS;
}

/** Les variables que lit `cardPreview.css`. */
export const PREVIEW_MOTION_VARS = {
  "--preview-enter-ms": `${PREVIEW_ENTER_MS}ms`,
  "--preview-enter-fade-ms": `${PREVIEW_ENTER_FADE_MS}ms`,
  "--preview-content-delay-ms": `${PREVIEW_CONTENT_DELAY_MS}ms`,
  "--preview-exit-ms": `${PREVIEW_EXIT_MS}ms`,
  "--preview-reduced-ms": `${PREVIEW_REDUCED_FADE_MS}ms`,
} as CSSProperties;
