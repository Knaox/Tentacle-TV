/**
 * Les tracés des glyphes de carte — signet, cœur, coche « vu », étoile.
 *
 * Données pures, sans rendu : le web les pose dans un `<svg>`, le mobile et la
 * TV dans `react-native-svg`. Un seul dessin pour toutes les plateformes, comme
 * un seul modèle (`cardMarkers.ts`) : une coche recopiée trois fois avait fini
 * par diverger, une icône le ferait tout autant.
 *
 * Grille 24 (étoile : grille 20), trait 1,8 aux coins arrondis pour les formes
 * au trait ; les mêmes chemins se remplissent quand l'état est vrai.
 */

export const CARD_GLYPH_VIEWBOX = "0 0 24 24";
export const CARD_GLYPH_STROKE = 1.8;

/** Signet (Ma liste). Au trait ou plein, même chemin. */
export const BOOKMARK_PATH =
  "M6.5 3.75h11a.75.75 0 0 1 .75.75v15.44a.5.5 0 0 1-.79.41L12 16.5l-5.46 3.85a.5.5 0 0 1-.79-.41V4.5a.75.75 0 0 1 .75-.75z";

/** Cœur (favori). Au trait ou plein, même chemin. */
export const HEART_PATH =
  "M21 8.25c0-2.49-2.1-4.5-4.69-4.5-1.93 0-3.6 1.13-4.31 2.73-.72-1.6-2.38-2.73-4.31-2.73C5.1 3.75 3 5.76 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z";

/** Coche « vu », pleine : disque plein, coche évidée (règle `evenodd`). */
export const WATCHED_FILLED_PATH =
  "M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5zm4.28 7.53a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5z";

/** Coche « vu », au trait : un cercle (cx 12, cy 12, r 9) et ce chemin. */
export const WATCHED_CHECK_PATH = "M8.25 12.25l2.5 2.5 5-5";

/**
 * « Sur cet appareil » : le disque plein de « vu », une FLÈCHE vers le bas
 * évidée (règle `evenodd`) — jamais une coche. Les deux voisinent dans la
 * même pastille : une seconde coche y dirait « vu » deux fois. Même famille
 * de forme, un autre signe, et une autre couleur (le vert de « prêt »).
 * Au repos comme au plateau, sur le bureau comme sur le mobile.
 */
export const KEPT_OFFLINE_PATH =
  "M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5zM12 16.5l-4.2-4.2 1.06-1.06 2.39 2.39V6.8h1.5v6.83l2.39-2.39 1.06 1.06L12 16.5z";

/** Étoile de la note, pleine, sur une grille 20. */
export const STAR_VIEWBOX = "0 0 20 20";
export const STAR_PATH =
  "M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29z";
