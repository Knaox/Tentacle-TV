import type { MediaItem } from "@tentacle-tv/shared";
import type { SafeInsets } from "../chrome/chromeInsets";

/**
 * Où se pose la liste des épisodes du lecteur — la carte qui s'ouvre, la
 * rangée de la TV au doigt (choix de Damien, 21/10) —, d'après l'écran et
 * l'IMAGE : la vidéo est cadrée entière (`contain`), un téléphone debout la
 * montre en bande au milieu, avec du noir dessous que la rangée occupe sans
 * rien cacher ; couché, la rangée se pose sur l'image, sous un voile.
 */

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

/** Le format de l'image d'un titre, d'après son flux vidéo ; 16:9 quand il ne le dit pas. */
export function videoAspectOf(item: Pick<MediaItem, "MediaSources" | "MediaStreams"> | null | undefined): number {
  const streams = item?.MediaSources?.[0]?.MediaStreams ?? item?.MediaStreams ?? [];
  const video = streams.find((stream) => stream.Type === "Video" && (stream.Width ?? 0) > 0 && (stream.Height ?? 0) > 0);
  const ratio = video ? (video.Width as number) / (video.Height as number) : 0;
  return ratio > 0.5 && ratio < 4 ? ratio : 16 / 9;
}

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
  /** Posée sous l'image (rien ne la couvre) : pas de voile sur la vidéo. */
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
  // Couché, la rangée occupe le milieu de la hauteur, où est l'îlot : elle prend la marge sûre.
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

/** La carte ouverte quand la rangée a défilé de `progress` pas : la plus proche, dans la saison. */
export function openIndexAt(progress: number, count: number): number {
  "worklet";
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(progress)));
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
