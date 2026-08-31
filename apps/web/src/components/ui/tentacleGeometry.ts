/**
 * Géométrie de la mascotte, en repère 240×240 — le MÊME que `brand/*.svg`.
 *
 * Les bras et les ventouses ne sont PAS écrits ici : ils sont générés par
 * `brand/generate-svg.py`, qui produit à la fois les SVG statiques et le module
 * `tentacleArmPaths.generated.ts` réexporté ci-dessous. Une spirale ne se dessine
 * pas à la main, et deux copies auraient fini par diverger.
 *
 * Ce fichier ne garde que ce qui se dessine à la main : le corps, le visage et le
 * chapeau. Le composant web existe séparément du fichier statique parce que lui
 * seul résout les variables CSS — une couleur de marque redéfinie par un
 * administrateur doit se propager jusqu'au logo.
 */
export type { ArmSegment, Sucker } from "./tentacleArmPaths.generated";
export {
  ANTENNA_PATHS,
  ANTENNA_SEGMENTS,
  ARM_SEGMENTS,
  BACK_ARM_PATHS,
  BACK_ARM_SEGMENTS,
  FRONT_ARM_PATHS,
  SUCKERS,
} from "./tentacleArmPaths.generated";

/** Manteau : carré très arrondi, de type tube cathodique. */
export const MANTLE_PATH =
  "M 120 54 C 152 54, 176 58, 186 68 C 194 76, 197 92, 197 118 C 197 144, 194 160, 186 168 C 176 178, 152 182, 120 182 C 88 182, 64 178, 54 168 C 46 160, 43 144, 43 118 C 43 92, 46 76, 54 68 C 64 58, 88 54, 120 54 Z";

/** Le tube. C'est lui qui dit « TV » sans cesser de dire « poulpe ». */
export const TUBE_PATH =
  "M 120 76 C 145 76, 163 79, 171 86 C 177 92, 179 102, 179 118 C 179 134, 177 144, 171 150 C 163 157, 145 160, 120 160 C 95 160, 77 157, 69 150 C 63 144, 61 134, 61 118 C 61 102, 63 92, 69 86 C 77 79, 95 76, 120 76 Z";

/** Reflet du verre, en haut du tube. */
export const GLASS_PATH =
  "M 120 79 C 143 79, 160 82, 168 88 C 172 91, 174 97, 175 106 C 150 98, 90 98, 65 106 C 66 97, 68 91, 72 88 C 80 82, 97 79, 120 79 Z";

/** Brillance du manteau. */
export const SHINE_PATH =
  "M 120 58 C 150 58, 172 62, 182 70 C 188 76, 191 84, 192 96 C 160 82, 80 82, 48 96 C 49 84, 52 76, 58 70 C 68 62, 90 58, 120 58 Z";

export const SMILE_PATH = "M 110 145 C 115 154, 125 154, 130 145";

/**
 * Le chapeau est écrit dans son propre repère (sommet à y=17, base à y=80) puis
 * ramené ici : il se remplace par un ornement saisonnier sans toucher au reste,
 * et se retaille en changeant la seule échelle.
 */
export const HAT_TRANSFORM =
  "translate(120 42) rotate(-8) scale(0.62) translate(-120 -48)";

/** Le monochrome porte un chapeau un peu plus large : il doit tenir sans son dégradé. */
export const HAT_TRANSFORM_MONO =
  "translate(120 42) rotate(-8) scale(0.64) translate(-120 -48)";

export const HAT_PATH =
  "M 120 17 C 141 17, 157 28, 164 45 C 173 37, 184 31, 194 28 C 201 26, 205 31, 202 38 C 196 52, 185 63, 171 70 C 156 77, 139 80, 120 80 C 101 80, 84 77, 69 70 C 55 63, 44 52, 38 38 C 35 31, 39 26, 46 28 C 56 31, 67 37, 76 45 C 83 28, 99 17, 120 17 Z";

export const HAT_BAND_PATH = "M 76 50 C 92 60, 148 60, 164 50";

/**
 * Bord inférieur du chapeau. Sert uniquement au monochrome : sans cette
 * séparation creusée, feutre et manteau — tous deux d'une seule couleur —
 * fusionnent en une masse et le chapeau disparaît.
 */
export const HAT_BRIM_PATH =
  "M 69 70 C 84 77, 101 80, 120 80 C 139 80, 156 77, 171 70";

export const SKULL_PATH =
  "M 120 27 C 128 27, 134 33, 134 40 C 134 44, 132 47, 129 49 L 129 52 C 129 54, 127 55, 125 55 L 115 55 C 113 55, 111 54, 111 52 L 111 49 C 108 47, 106 44, 106 40 C 106 33, 112 27, 120 27 Z";
