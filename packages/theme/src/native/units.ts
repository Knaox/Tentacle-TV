/**
 * Chaînes CSS → nombres React Native.
 *
 * Les jetons de ce paquet sont des chaînes (`"16px"`, `"240ms"`, `"1.5"`) parce
 * qu'ils doivent pouvoir être émis tels quels en variables CSS. React Native
 * veut des nombres sans unité. Ces trois fonctions sont le pont.
 *
 * Elles vivaient dans `apps/tv/src/theme/utils.ts`, où elles n'étaient appelées
 * par personne — le pont existait sans que rien ne le traverse, et `apps/tv`
 * gardait en parallèle sa propre échelle de valeurs écrite à la main. Les
 * remonter ici les rend utilisables par les deux cibles natives.
 *
 * Module pur : ni DOM, ni React Native, ni import de plateforme.
 */

/** `"16px"` → `16`. Renvoie `fallback` si la chaîne n'est pas un nombre. */
export function parsePx(value: string, fallback = 0): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** `"240ms"` → `240`. Renvoie `fallback` si la chaîne n'est pas un nombre. */
export function parseMs(value: string, fallback = 0): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** `"1.08"` → `1.08`. Renvoie `fallback` (1) si la chaîne n'est pas un nombre —
 * une échelle nulle ferait disparaître l'élément, un repli à 1 le laisse
 * simplement à sa taille. */
export function parseScale(value: string, fallback = 1): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Une ombre CSS (`"0 6px 18px rgba(0, 0, 0, 0.6)"`) → un style d'ombre natif.
 *
 * iOS et Android ne décrivent pas une ombre de la même façon : iOS prend une
 * couleur, un décalage, une opacité et un rayon ; Android ne prend qu'une
 * `elevation`, dont il déduit tout le reste. On renvoie les deux, et chaque
 * plateforme ignore ce qui ne la concerne pas.
 *
 * `elevation` est dérivée du rayon de flou, faute de mieux : c'est la seule
 * grandeur des deux modèles qui décrive la même chose — l'étendue de l'ombre.
 */
export interface NativeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

// `px` est optionnel : un zéro s'écrit sans unité en CSS, et c'est exactement
// la forme qu'emploient les jetons du thème (`0 6px 18px rgba(…)`). L'exiger
// faisait échouer la lecture des trois élévations.
const LENGTH = String.raw`(-?[\d.]+)(?:px)?`;
const SHADOW_PATTERN = new RegExp(
  `^${LENGTH}\\s+${LENGTH}\\s+${LENGTH}\\s+(rgba?\\([^)]*\\)|#[0-9a-fA-F]+)$`,
);

export function parseShadow(value: string): NativeShadow | null {
  const match = SHADOW_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, x, y, blur, color] = match;
  const alpha = /rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(color);

  return {
    // La couleur est passée sans son alpha : React Native le lit dans
    // `shadowOpacity`, et le laisser dans les deux endroits le compterait deux
    // fois — l'ombre sortirait bien plus claire que sur le web.
    shadowColor: alpha ? color.replace(/rgba?\(([^)]*),[^,)]*\)$/, "rgb($1)") : color,
    shadowOffset: { width: parseFloat(x), height: parseFloat(y) },
    shadowOpacity: alpha ? parseFloat(alpha[1]) : 1,
    shadowRadius: parseFloat(blur),
    elevation: Math.round(parseFloat(blur) / 2),
  };
}
