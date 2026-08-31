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

/**
 * Du plus fin au plus épais : l'ordre de rendu, que le gros recouvre les jonctions.
 *
 * QUATRE paliers, pas trois. Avec trois, la tige gardait une épaisseur presque
 * constante jusqu'à une pointe encore large, qui finissait sur un enroulement
 * serré : le trait y repassait sur lui-même et reformait une masse au bout, dont
 * la forme prêtait à confusion. Le quatrième palier effile vraiment la pointe.
 */
export const ARM_SEGMENTS: readonly ArmSegment[] = [
  { width: 3.6, dash: "0 68 34 300" },
  { width: 9, dash: "0 46 26 300" },
  { width: 17, dash: "0 26 24 300" },
  { width: 26, dash: "30 300" },
];

/** Les bras arrière sont à peine plus grêles — la profondeur vient surtout du dégradé. */
export const BACK_ARM_SEGMENTS: readonly ArmSegment[] = [
  { width: 3.4, dash: "0 68 34 300" },
  { width: 8.5, dash: "0 46 26 300" },
  { width: 16, dash: "0 26 24 300" },
  { width: 25, dash: "30 300" },
];

export const ANTENNA_SEGMENTS: readonly ArmSegment[] = [
  { width: 2.8, dash: "0 70 32 300" },
  { width: 6, dash: "0 48 26 300" },
  { width: 12, dash: "0 26 26 300" },
  { width: 19, dash: "30 300" },
];

/**
 * Antennes. Leurs bases sont posées sur les COINS hauts du manteau, hors de
 * l'emprise du chapeau : les faire partir du sommet les ferait croiser les ailes
 * du tricorne, et les deux devenaient illisibles.
 */
export const ANTENNA_PATHS = {
  left: "M 64 64 C 58 46, 54 32, 45 25 C 38 20, 32 25, 37 31",
  right: "M 176 64 C 182 46, 186 32, 195 25 C 202 20, 208 25, 203 31",
} as const;

/** Bras extérieurs, derrière le corps. */
export const BACK_ARM_PATHS = [
  "M 62 172 C 47 189, 30 199, 17 202 C 11 203, 8 200, 10 196",
  "M 178 172 C 193 189, 210 199, 223 202 C 229 203, 232 200, 230 196",
] as const;

/**
 * Bras avant. Quatre, et non trois : un poulpe a HUIT bras, dont deux sont ici
 * dressés en antennes — il en fallait donc six en dessous, pas cinq.
 *
 * Longueurs et courbures volontairement inégales : quatre fuseaux parallèles de
 * même longueur lisaient « peigne », et cette régularité alourdissait la masse.
 * Aucune pointe ne se referme en boucle.
 */
export const FRONT_ARM_PATHS = [
  "M 88 180 C 82 199, 71 212, 57 218 C 50 221, 45 218, 47 213",
  "M 108 184 C 106 207, 100 226, 90 237 C 86 241, 81 240, 83 235",
  "M 132 184 C 135 205, 141 221, 151 231 C 155 235, 160 234, 158 229",
  "M 152 180 C 158 200, 169 215, 184 222 C 191 225, 196 222, 194 217",
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

/**
 * Ventouses. Elles ne sont pas décoratives : elles disent « tentacule » mieux
 * que la silhouette seule, en rompant la régularité du fuseau.
 */
export const SUCKERS = [
  { cx: 79, cy: 197, r: 3.2 },
  { cx: 69, cy: 208, r: 2.6 },
  { cx: 59, cy: 214, r: 2 },
  { cx: 104, cy: 204, r: 3.2 },
  { cx: 99, cy: 220, r: 2.6 },
  { cx: 91, cy: 231, r: 2 },
  { cx: 137, cy: 203, r: 3.2 },
  { cx: 143, cy: 217, r: 2.6 },
  { cx: 150, cy: 226, r: 2 },
  { cx: 162, cy: 199, r: 3.2 },
  { cx: 172, cy: 211, r: 2.6 },
  { cx: 182, cy: 218, r: 2 },
  { cx: 34, cy: 195, r: 2.5 },
  { cx: 206, cy: 195, r: 2.5 },
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
