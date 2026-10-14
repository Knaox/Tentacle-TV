/**
 * La géométrie de la scène de l'aperçu au survol (1.29.0), en px du canevas
 * logique (640 × 360). Les proportions suivent l'app : à une fenêtre de
 * bureau, la mini-carte fait près de deux fois la largeur d'une affiche
 * (~23 % de la fenêtre), vidéo 16:9 en haut et bandeau dessous (sa hauteur
 * suit la largeur, ~0,42 ×), centrée sur l'affiche qu'elle couvre — et les
 * voisines s'écartent de ce qu'elle déborde. Recopiée de
 * `components/cards/preview/previewPlacement.ts`, sans l'importer : l'écran
 * des nouveautés est compilé par le client LG, qui ne compile pas ce dossier
 * (`EXCLUDED_WEB_DIRECTORIES`).
 */

/** La rangée survolée : son titre, puis ses affiches, la dernière coupée par le bord. */
export const ROW = { x: 24, y: 26, titleH: 26 } as const;
export const POSTER = { w: 96, h: 144, gap: 14 } as const;
export const POSTER_COUNT = 6;
/** L'affiche que le pointeur vise. */
export const HOVERED = 2;
export const POSTERS_Y = ROW.y + ROW.titleH;

export function posterX(index: number): number {
  return ROW.x + index * (POSTER.w + POSTER.gap);
}

/** La mini-carte : ~1,85 × l'affiche, vidéo 16:9 puis bandeau (actions, puis infos). */
export const PREVIEW_W = Math.round(POSTER.w * 1.85);
export const VIDEO_H = Math.round((PREVIEW_W * 9) / 16);
export const BAND_H = Math.round(PREVIEW_W * 0.42);
/** Jamais moins haute que l'affiche à couvrir, plus 8 px de chaque côté (`PREVIEW_COVER_PX`). */
export const PREVIEW_H = Math.max(VIDEO_H + BAND_H, POSTER.h + 16);

/** Centrée sur l'affiche visée. */
export const PREVIEW_RECT = {
  x: Math.round(posterX(HOVERED) + POSTER.w / 2 - PREVIEW_W / 2),
  y: Math.round(POSTERS_Y + POSTER.h / 2 - PREVIEW_H / 2),
} as const;

/** Le départ de l'agrandissement : la plus grande échelle UNIFORME qui tient dans l'affiche. */
export const PREVIEW_FROM_SCALE = Math.min(POSTER.w / PREVIEW_W, POSTER.h / PREVIEW_H);

/** Ce dont les voisines s'écartent : le débord de la mini-carte, plus un souffle. */
export const NEIGHBOR_SHIFT = Math.round((PREVIEW_W - POSTER.w) / 2) + 4;

/** Les boutons ronds du bandeau : Lire, Ma liste, favori, vu. */
export const ACTION = { x: 9, y: 9, size: 22, gap: 6 } as const;

/** Le centre du bouton `index` du bandeau, en px du canevas (la cible du pointeur). */
export function actionCenter(index: number): { x: number; y: number } {
  return {
    x: PREVIEW_RECT.x + ACTION.x + index * (ACTION.size + ACTION.gap) + ACTION.size / 2,
    y: PREVIEW_RECT.y + VIDEO_H + ACTION.y + ACTION.size / 2,
  };
}

/** La seconde rangée, sous la première : la mini-carte passe AU-DESSUS du reste de la page. */
export const NEXT_ROW_Y = POSTERS_Y + POSTER.h + 30;
