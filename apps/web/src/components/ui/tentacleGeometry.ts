/**
 * Géométrie de la mascotte, en repère 240×240 — le MÊME que `brand/logo-color.svg`.
 * Les deux doivent rester dans le même repère : sinon toute retouche du dessin
 * se fait deux fois, et l'un des deux finit par dériver en silence.
 *
 * Un bras n'est pas un contour fermé mais un tracé unique rendu trois fois, en
 * largeurs décroissantes découpées au `stroke-dasharray` (d'où `pathLength=100`,
 * qui rend les bornes lisibles en pourcentage). Dessiné du plus fin au plus
 * épais, l'arrondi des bouts fond les jonctions. Un enroulement se retouche donc
 * en changeant une seule courbe, et non deux bords à garder parallèles.
 */

/** Un segment de bras : largeur du trait, et la portion de tracé qu'il couvre. */
export interface ArmSegment {
  width: number;
  dash: string;
}

/** Du plus fin au plus épais : l'ordre de rendu, que le gros recouvre les jonctions. */
export const ARM_SEGMENTS: readonly ArmSegment[] = [
  { width: 8, dash: "0 56 46 300" },
  { width: 18, dash: "0 28 32 300" },
  { width: 29, dash: "34 300" },
];

/** Les bras arrière sont à peine plus grêles — la profondeur vient surtout du dégradé. */
export const BACK_ARM_SEGMENTS: readonly ArmSegment[] = [
  { width: 8, dash: "0 56 46 300" },
  { width: 18, dash: "0 28 32 300" },
  { width: 28, dash: "34 300" },
];

export const ANTENNA_SEGMENTS: readonly ArmSegment[] = [
  { width: 5, dash: "0 54 48 300" },
  { width: 12, dash: "0 26 34 300" },
  { width: 20, dash: "32 300" },
];

/**
 * Antennes. Leurs bases sont posées sur les COINS hauts du manteau, hors de
 * l'emprise du chapeau : les faire partir du sommet les ferait croiser les ailes
 * du tricorne, et les deux devenaient illisibles.
 */
export const ANTENNA_PATHS = {
  left: "M 64 64 C 58 46, 54 32, 45 25 C 37 19, 30 26, 37 32",
  right: "M 176 64 C 182 46, 186 32, 195 25 C 203 19, 210 26, 203 32",
} as const;

/** Bras extérieurs, derrière le corps. */
export const BACK_ARM_PATHS = [
  "M 62 172 C 50 190, 34 200, 21 194 C 12 190, 14 178, 24 180 C 32 182, 36 178, 36 170",
  "M 178 172 C 190 190, 206 200, 219 194 C 228 190, 226 178, 216 180 C 208 182, 204 178, 204 170",
] as const;

/** Bras avant. Le central est rendu en dernier. */
export const FRONT_ARM_PATHS = [
  "M 90 182 C 84 202, 72 216, 57 219 C 47 221, 42 213, 49 208 C 56 203, 61 206, 65 197",
  "M 150 182 C 156 202, 168 216, 183 219 C 193 221, 198 213, 191 208 C 184 203, 179 206, 175 197",
  "M 120 186 C 121 206, 116 224, 104 232 C 96 237, 88 231, 93 224 C 98 217, 105 219, 108 210",
] as const;

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

/** Ventouses : uniquement sur la face interne des bras avant. */
export const SUCKERS = [
  { cx: 76, cy: 200, r: 3.4 },
  { cx: 64, cy: 211, r: 2.8 },
  { cx: 115, cy: 206, r: 3.4 },
  { cx: 106, cy: 219, r: 2.8 },
  { cx: 164, cy: 200, r: 3.4 },
  { cx: 176, cy: 211, r: 2.8 },
] as const;

/**
 * Le chapeau est écrit dans son propre repère (sommet à y=17, base à y=80) puis
 * ramené ici. Garder ce repère permet de le remplacer par un ornement saisonnier
 * sans toucher au reste, et de le retailler en changeant la seule échelle.
 */
export const HAT_TRANSFORM =
  "translate(120 42) rotate(-8) scale(0.62) translate(-120 -48)";

export const HAT_PATH =
  "M 120 17 C 141 17, 157 28, 164 45 C 173 37, 184 31, 194 28 C 201 26, 205 31, 202 38 C 196 52, 185 63, 171 70 C 156 77, 139 80, 120 80 C 101 80, 84 77, 69 70 C 55 63, 44 52, 38 38 C 35 31, 39 26, 46 28 C 56 31, 67 37, 76 45 C 83 28, 99 17, 120 17 Z";

export const HAT_BAND_PATH = "M 76 50 C 92 60, 148 60, 164 50";

export const SKULL_PATH =
  "M 120 27 C 128 27, 134 33, 134 40 C 134 44, 132 47, 129 49 L 129 52 C 129 54, 127 55, 125 55 L 115 55 C 113 55, 111 54, 111 52 L 111 49 C 108 47, 106 44, 106 40 C 106 33, 112 27, 120 27 Z";

/**
 * Bord inférieur du chapeau. Sert uniquement au monochrome : sans cette
 * séparation creusée, feutre et manteau — tous deux d'une seule couleur —
 * fusionnent en une masse et le chapeau disparaît.
 */
export const HAT_BRIM_PATH =
  "M 69 70 C 84 77, 101 80, 120 80 C 139 80, 156 77, 171 70";

/** Le monochrome porte un chapeau un peu plus large : il doit tenir sans son dégradé. */
export const HAT_TRANSFORM_MONO =
  "translate(120 42) rotate(-8) scale(0.64) translate(-120 -48)";
