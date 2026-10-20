import type { SafeInsets } from "../chrome/chromeInsets";

/**
 * Où se posent les trois mises en page de la liste des épisodes du lecteur,
 * d'après l'écran et l'IMAGE — la vidéo est cadrée entière (`contain`) : un
 * téléphone debout la montre en bande au milieu, avec du noir dessus et
 * dessous, que la liste peut occuper sans rien cacher.
 *
 * - `shelf` (l'étagère) : des cartes 16:9 qui défilent de côté, en bas ; sous
 *   l'image quand elle y tient (portrait), sur l'image sinon (paysage).
 * - `open` (la carte qui s'ouvre) : la même place, mais la carte posée au
 *   retrait grandit, ses détails dessous — la rangée qui s'ouvre de la TV.
 * - `panel` (le panneau) : une colonne de verre à droite (paysage) ; debout,
 *   une feuille sous l'image, que l'on remonte en haut de l'écran.
 * - `index` (le sommaire) : tout l'écran, les saisons en colonne à gauche
 *   (paysage) ou en bande (portrait), les épisodes en liste numérotée.
 */
export type EpisodeBrowserStyle = "shelf" | "open" | "panel" | "index";

export interface BrowserScreen {
  width: number;
  height: number;
  isTablet: boolean;
  /** Les marges des commandes (`chromeInsets`). */
  edges: SafeInsets;
  /** Les marges sûres du système (encoche, îlot, indicateur d'accueil). */
  safe: SafeInsets;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** L'image d'une vidéo cadrée entière dans l'écran. */
export function videoRect(width: number, height: number, aspect = 16 / 9): Rect {
  const fitsWidth = width / height < aspect;
  const w = fitsWidth ? width : Math.round(height * aspect);
  const h = fitsWidth ? Math.round(width / aspect) : height;
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
}

/* ---------------------------------------------------------------- étagère */

/** La hauteur d'une ligne de texte des cartes de l'étagère (titre, résumé). */
export const SHELF_TYPE = { kicker: 16, titleLine: 19, overviewLine: 17 } as const;
const SHELF_TABS = { phone: 40, tablet: 46 } as const;
const SHELF_GAPS = { tabs: 12, caption: 10, kicker: 4, overview: 4 } as const;

export interface ShelfGeometry {
  /** Le haut de l'étagère (onglets compris). */
  top: number;
  /** Le retrait du contenu, à gauche comme à droite. */
  inset: number;
  /** L'air sous les cartes, indicateur d'accueil compris. */
  bottom: number;
  cardWidth: number;
  thumbHeight: number;
  /** 0 : pas de résumé sous le titre ; 2 : deux lignes. */
  overviewLines: 0 | 2;
  /** Posée sous l'image (rien ne la couvre) : pas de voile sur la vidéo. */
  belowVideo: boolean;
}

export function shelfContentHeight(isTablet: boolean, thumbHeight: number, overviewLines: 0 | 2): number {
  const tabs = isTablet ? SHELF_TABS.tablet : SHELF_TABS.phone;
  // Le titre d'une tablette prend deux points de plus par ligne.
  const titleLine = SHELF_TYPE.titleLine + (isTablet ? 2 : 0);
  const caption = SHELF_TYPE.kicker + SHELF_GAPS.kicker + titleLine * 2
    + (overviewLines > 0 ? SHELF_GAPS.overview + SHELF_TYPE.overviewLine * overviewLines : 0);
  return tabs + SHELF_GAPS.tabs + thumbHeight + SHELF_GAPS.caption + caption;
}

export function shelfGeometry(screen: BrowserScreen, video: Rect): ShelfGeometry {
  const { width, height, isTablet, edges, safe } = screen;
  const landscape = width > height;
  // Couché, le repos de l'étagère s'écarte de l'îlot (marge sûre) ; le défilement passe dessous.
  const inset = Math.max(isTablet ? 32 : 20, landscape ? Math.max(edges.left, edges.right, safe.left, safe.right) : 0);
  const bottom = Math.max(edges.bottom, safe.bottom) + (isTablet ? 22 : 12);
  const cardWidth = isTablet
    ? (landscape ? 296 : 264)
    : (landscape ? 196 : Math.round((width - inset) * 0.62));
  const thumbHeight = Math.round((cardWidth * 9) / 16);

  if (!landscape) {
    // Debout : sous l'image, si elle y tient — avec son résumé, sinon sans.
    const room = height - bottom - (video.y + video.height);
    for (const lines of [2, 0] as const) {
      const content = shelfContentHeight(isTablet, thumbHeight, lines);
      if (content <= room - 8) {
        const gap = Math.min(28, Math.max(8, Math.round((room - content) / 2)));
        return { top: video.y + video.height + gap, inset, bottom, cardWidth, thumbHeight, overviewLines: lines, belowVideo: true };
      }
    }
  }
  const overviewLines: 0 | 2 = isTablet ? 2 : 0;
  const content = shelfContentHeight(isTablet, thumbHeight, overviewLines);
  return { top: height - bottom - content, inset, bottom, cardWidth, thumbHeight, overviewLines, belowVideo: false };
}

/* ------------------------------------------------------- carte qui s'ouvre */

export interface OpenShelfGeometry {
  top: number;
  inset: number;
  bottom: number;
  /** La carte ouverte (16:9). */
  openWidth: number;
  openHeight: number;
  /** Une carte au repos : la même image, plus petite. */
  restWidth: number;
  /** La hauteur réservée aux détails de la carte ouverte (rien ne se remet en page). */
  detailsHeight: number;
  titleLines: 1 | 2;
  overviewLines: 1 | 2;
  belowVideo: boolean;
}

const OPEN_TABS = { phone: 40, tablet: 46 } as const;
const OPEN_GAPS = { tabs: 12, details: 12 } as const;

/** Les détails sous la carte ouverte : surtitre, titre (une ou deux lignes), résumé. */
export function openDetailsHeight(isTablet: boolean, titleLines: 1 | 2, overviewLines: 1 | 2): number {
  const line = isTablet ? 19 : 17;
  return (isTablet ? 18 : 16) + 4 + (isTablet ? 24 : 21) * titleLines + 6 + line * overviewLines;
}

export function openShelfGeometry(screen: BrowserScreen, video: Rect): OpenShelfGeometry {
  const { width, height, isTablet, edges, safe } = screen;
  const landscape = width > height;
  const inset = Math.max(isTablet ? 32 : 20, landscape ? Math.max(edges.left, edges.right, safe.left, safe.right) : 0);
  const bottom = Math.max(edges.bottom, safe.bottom) + (isTablet ? 22 : 12);
  const openWidth = isTablet ? (landscape ? 340 : 300) : (landscape ? 200 : 208);
  const openHeight = Math.round((openWidth * 9) / 16);
  const restWidth = Math.round(openWidth * 0.6);
  const tabs = isTablet ? OPEN_TABS.tablet : OPEN_TABS.phone;
  // Debout, le titre a deux lignes : le bouton « Lire » lui prend la largeur.
  const titleLines: 1 | 2 = landscape ? 1 : 2;
  const content = (lines: 1 | 2) => tabs + OPEN_GAPS.tabs + openHeight + OPEN_GAPS.details + openDetailsHeight(isTablet, titleLines, lines);
  const place = (top: number, lines: 1 | 2, belowVideo: boolean): OpenShelfGeometry => ({
    top, inset, bottom, openWidth, openHeight, restWidth,
    detailsHeight: openDetailsHeight(isTablet, titleLines, lines), titleLines, overviewLines: lines, belowVideo,
  });

  if (!landscape) {
    const room = height - bottom - (video.y + video.height);
    for (const lines of [2, 1] as const) {
      if (content(lines) <= room - 8) {
        const gap = Math.min(28, Math.max(8, Math.round((room - content(lines)) / 2)));
        return place(video.y + video.height + gap, lines, true);
      }
    }
  }
  const lines: 1 | 2 = isTablet ? 2 : 1;
  return place(height - bottom - content(lines), lines, false);
}

export interface OpenCardPlace {
  /** Le bord gauche de la carte, dans le contenu de la rangée. */
  left: number;
  /** Sa largeur à l'écran. */
  width: number;
  /** Son échelle, de `restWidth / openWidth` (au repos) à 1 (ouverte). */
  scale: number;
}

/**
 * Où est la carte `index` quand la rangée a défilé de `progress` pas : la
 * carte posée au retrait s'ouvre, ses voisines suivantes glissent d'autant —
 * la règle de la rangée qui s'ouvre de la TV, en continu sous le doigt. Une
 * fonction de travail (worklet) : la même sert au rendu, sur le fil
 * d'interface, et au toucher.
 */
export function openCardPlace(index: number, progress: number, step: number, restWidth: number, openWidth: number): OpenCardPlace {
  "worklet";
  const rest = restWidth / openWidth;
  const openness = Math.max(0, 1 - Math.abs(index - progress));
  const scale = rest + (1 - rest) * openness;
  const pushed = Math.min(1, Math.max(0, index - progress));
  return { left: index * step + (openWidth - restWidth) * pushed, width: scale * openWidth, scale };
}

/** La carte sous le doigt (`x` dans le contenu de la rangée), ou `null` entre deux cartes. */
export function openCardAt(x: number, progress: number, step: number, restWidth: number, openWidth: number, count: number): number | null {
  for (let index = Math.max(0, Math.floor(progress) - 1); index < count; index++) {
    const place = openCardPlace(index, progress, step, restWidth, openWidth);
    if (x < place.left) return null;
    if (x <= place.left + place.width) return index;
  }
  return null;
}

/* ---------------------------------------------------------------- panneau */

export interface PanelGeometry {
  /** `side` : colonne à droite ; `sheet` : feuille sous l'image remontée. */
  mode: "side" | "sheet";
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
  /** De combien l'image remonte (feuille seulement) : elle se pose sous la barre d'état. */
  videoLift: number;
  /** La vignette d'une ligne. */
  thumbWidth: number;
  /** Les lignes de résumé sous le titre. */
  overviewLines: 0 | 1 | 2;
}

export function panelGeometry(screen: BrowserScreen, video: Rect): PanelGeometry {
  const { width, height, isTablet, edges, safe } = screen;
  const landscape = width > height;
  if (landscape) {
    const panelWidth = isTablet ? 440 : Math.min(392, Math.round(width * 0.47));
    // L'îlot d'un iPhone couché est au milieu d'un côté : la colonne, haute, s'en écarte.
    const right = Math.max(edges.right, isTablet ? 20 : safe.right - 8);
    const top = isTablet ? Math.max(edges.top, safe.top) + 4 : Math.max(edges.top, 10);
    const bottom = isTablet ? Math.max(edges.bottom, safe.bottom) + 4 : Math.max(edges.bottom, 10);
    return {
      mode: "side", top, right, bottom, left: width - right - panelWidth, radius: isTablet ? 30 : 26,
      videoLift: 0, thumbWidth: isTablet ? 168 : 128, overviewLines: isTablet ? 2 : 1,
    };
  }
  // Debout : l'image monte sous la barre d'état, la feuille prend le reste.
  const videoTop = Math.max(safe.top, edges.top);
  const videoLift = Math.max(0, video.y - videoTop);
  const top = video.y + video.height - videoLift + (isTablet ? 14 : 10);
  return {
    mode: "sheet", top, right: 0, bottom: 0, left: 0, radius: isTablet ? 30 : 28,
    videoLift, thumbWidth: isTablet ? 176 : 132, overviewLines: 2,
  };
}

/* --------------------------------------------------------------- sommaire */

export interface IndexGeometry {
  /** Deux colonnes (saisons à gauche) en paysage ; une seule debout. */
  columns: 1 | 2;
  /** Les marges du contenu plein écran. */
  padding: SafeInsets;
  /** La colonne des saisons (deux colonnes seulement). */
  seasonsWidth: number;
  /** La vignette au bout d'une ligne d'épisode. */
  thumbWidth: number;
}

export function indexGeometry(screen: BrowserScreen): IndexGeometry {
  const { width, height, isTablet, safe } = screen;
  const landscape = width > height;
  const side = isTablet ? 40 : 22;
  const padding = {
    top: Math.max(safe.top, landscape && !isTablet ? 18 : 12) + (isTablet ? 12 : 4),
    bottom: Math.max(safe.bottom, 16),
    left: Math.max(safe.left, side),
    right: Math.max(safe.right, side),
  };
  if (landscape || (isTablet && width >= 900)) {
    const usable = width - padding.left - padding.right;
    return { columns: 2, padding, seasonsWidth: Math.round(Math.min(isTablet ? 320 : 250, usable * 0.32)), thumbWidth: isTablet ? 176 : 132 };
  }
  return { columns: 1, padding, seasonsWidth: 0, thumbWidth: isTablet ? 168 : 112 };
}
