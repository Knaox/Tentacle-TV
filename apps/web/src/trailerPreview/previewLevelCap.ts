/**
 * Le PLAFOND de qualité d'un aperçu : la vidéo n'a pas à être plus grande que
 * la boîte où elle s'affiche. Une 1080p dans une mini-carte de 300 à 560 px,
 * c'est jusqu'à neuf fois les pixels d'une boîte en densité 1 — décodés,
 * téléchargés, mis à l'échelle pour rien. On prend le PLUS PETIT niveau qui
 * couvre ENTIÈREMENT la boîte en pixels de l'écran (CSS × `devicePixelRatio`),
 * jamais un niveau agrandi : vue à l'œil sur un écran Retina, une 360p étirée
 * de 3 % dans 662 px physiques est molle (texte flou, blocs de compression),
 * la 720p nette, la 1080p identique à la 720p. D'où : 720p sur Retina pour
 * une mini-carte de 331 à 560 px, 360p en densité 1. La vidéo est posée en
 * `object-fit: cover` : un niveau la couvre
 * s'il la remplit en largeur ET en hauteur (une 2,39:1 doit avoir la hauteur
 * de la boîte, une 4:3 sa largeur).
 *
 * La langue passe avant la définition (décision A6) : ce plafond ne touche
 * qu'aux niveaux de la bande-annonce choisie, jamais au choix lui-même.
 */

export interface LevelSize {
  width?: number;
  height?: number;
}

export interface BoxSize {
  width: number;
  height: number;
}

/**
 * La boîte supposée quand l'élément n'est pas encore posé (taille nulle) : la
 * plus grande mini-carte (560 px, vidéo 16:9). Jamais « sans plafond ».
 */
export const FALLBACK_BOX: BoxSize = { width: 560, height: 315 };

/**
 * L'index (dans `levels`, triés du plus petit au plus grand comme hls.js les
 * range) du plus petit niveau qui couvre `box` à la densité `dpr` ; le plus
 * grand s'il n'y en a aucun ; `-1` sans niveau à dimensions connues (MP4,
 * audio seul) — pas de plafond.
 */
export function capLevelFor(levels: readonly LevelSize[], box: BoxSize, dpr: number): number {
  const sized = levels.map((level, index) => ({ index, width: level.width ?? 0, height: level.height ?? 0 }))
    .filter((level) => level.width > 0 && level.height > 0);
  if (sized.length === 0) return -1;
  const target = box.width > 0 && box.height > 0 ? box : FALLBACK_BOX;
  const scale = dpr > 0 ? dpr : 1;
  const needW = target.width * scale;
  const needH = target.height * scale;
  const covering = sized
    .filter((level) => level.width >= needW && level.height >= needH)
    .sort((a, b) => a.height - b.height || a.width - b.width);
  if (covering.length > 0) return covering[0].index;
  return sized.sort((a, b) => b.height - a.height || b.width - a.width)[0].index;
}
