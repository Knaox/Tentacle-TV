/**
 * Géométrie de la mascotte, en repère 240×240 — le MÊME que `brand/*.svg`.
 *
 * Depuis le dessin « l'Étreinte » (2026-09), TOUT vient du module généré par
 * `brand/generate-svg.py` : bras, ventouses, tête, écran, visage et chapeau.
 * Plus rien ne s'écrit à la main ici — les chaînes dupliquées entre ce fichier
 * et le module natif avaient déjà divergé une fois (échelles de chapeau).
 *
 * Ce fichier ne subsiste que comme point d'import stable : les composants
 * consomment la géométrie ici, et la provenance peut changer sans les toucher.
 */
export type { Circle, EllipseSpec } from "./tentacleArmPaths.generated";
export {
  BACK_ARM_PATHS,
  CHEEKS,
  EYE_GLINTS,
  EYE_PUPILS,
  EYE_WHITES,
  FRONT_ARM_PATHS,
  HAT_BAND_PATH,
  HAT_BRIM_PATH,
  HAT_PATH,
  HAT_TRANSFORM,
  HEAD_PATH,
  PLAY_PATH,
  SCREEN,
  SHINE_PATH,
  SKULL_PATH,
  SMILE_PATH,
  SUCKERS,
  SUCKER_SHADOW,
} from "./tentacleArmPaths.generated";
