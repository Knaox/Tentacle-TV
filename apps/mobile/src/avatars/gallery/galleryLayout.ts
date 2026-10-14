/**
 * La grille de la galerie : trois colonnes sur un téléphone, quel qu'il soit ;
 * sur une tablette, autant que la feuille en loge (quatre à six). Le rond suit
 * la colonne, sans dépasser `ART_MAX`, et garde la place de son nom dessous.
 *
 * Module PUR : testé sous vitest.
 */

/** La marge de la feuille, de chaque côté. */
export const GALLERY_GUTTER = 20;
/** L'écart entre deux colonnes : 8 pt au moins entre deux cibles. */
export const GALLERY_GAP = 12;
const ART_MAX = 88;
/** Le rond laisse cette marge à sa colonne (l'anneau du choix l'entoure). */
const ART_INSET = 16;
/** Sur une tablette, une colonne n'est pas plus étroite. */
const TABLET_COLUMN_MIN = 96;

export interface GalleryLayout {
  columns: number;
  /** La largeur d'une tuile (sa cible tactile entière). */
  tileWidth: number;
  /** Le diamètre du portrait. */
  art: number;
}

export function galleryLayout(sheetWidth: number, isTablet: boolean): GalleryLayout {
  const inner = Math.max(0, sheetWidth - GALLERY_GUTTER * 2);
  const fit = Math.floor((inner + GALLERY_GAP) / (TABLET_COLUMN_MIN + GALLERY_GAP));
  const columns = isTablet ? Math.min(6, Math.max(4, fit)) : 3;
  const tileWidth = Math.max(0, Math.floor((inner - GALLERY_GAP * (columns - 1)) / columns));
  return { columns, tileWidth, art: Math.max(0, Math.min(ART_MAX, tileWidth - ART_INSET)) };
}
