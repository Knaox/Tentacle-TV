import { PREVIEW_ZONE_HEIGHT } from "../focus/previewZoneLayout";
import { PREVIEW_ZONE_TEXT } from "./previewZoneText";

/**
 * La zone d'aperçu PENDANT la bande-annonce (Apple TV, Android TV). Deux
 * retours de Damien, le 18/10 : d'abord « on ne voit pas bien la
 * bande-annonce, le texte raccourci dérange », puis, une fois le texte retiré,
 * « toute la gauche devient une grande zone noire, c'est dommage ».
 *
 * Dès que la vidéo a sa première image, le texte du repos (surtitre, raison,
 * grand logo, synopsis long) passe en fondu croisé à une version ALLÉGÉE mais
 * REMPLIE, dans la colonne à gauche de la vidéo — jamais par-dessus elle :
 * le logo, plus petit ; la ligne de métadonnées ; une description courte en
 * phrases entières (`fitPreviewZoneSynopsis`) ; l'indice de la télécommande.
 * La vidéo garde toute sa largeur ; les voiles pleins du repos s'effacent.
 *
 * La version allégée reste tant que la vidéo se montre, pause comprise (la
 * pause garde l'image : l'indice y dit comment reprendre). Tout revient au
 * changement de focus et à la fin de l'aperçu. Deux calques en fondu
 * d'opacité : rien ne se remet en page, la navigation n'attend rien.
 *
 * Module pur.
 */

export const PREVIEW_ZONE_PLAYBACK = {
  /** Le repos qui cède à la version allégée, sur l'entrée de la vidéo (360 ms) : un peu plus posé. */
  recedeMs: 420,
  /** Le repos qui revient : plus bref (la sortie de la vidéo, 180 ms, et un peu plus). */
  returnMs: 240,
} as const;

export interface PreviewZonePlaybackInput {
  /** La vidéo de la zone a sa première image, et se montre. */
  videoShown: boolean;
}

/** Vrai quand la zone passe à sa version allégée : la vidéo se montre (en pause aussi). */
export function previewZoneWatching(input: PreviewZonePlaybackInput): boolean {
  return input.videoShown;
}

/**
 * La durée du fondu vers l'état demandé. Une surface (carte ouverte, bannière)
 * qui PERD le focus pendant sa vidéo reprend son image d'un coup : la vidéo,
 * elle, se coupe au même instant — un fondu de retour y laissait une carte
 * transparente, un trou noir, le temps qu'elle s'en aille.
 */
export function previewZoneWatchingMs(watching: boolean, focused = true): number {
  if (!watching && !focused) return 0;
  return watching ? PREVIEW_ZONE_PLAYBACK.recedeMs : PREVIEW_ZONE_PLAYBACK.returnMs;
}

/**
 * La version allégée, en points de la scène : une colonne entre le texte de
 * la page (`left`, le retrait du contenu) et le bord gauche de la vidéo
 * (`mediaLeft`), moins un écart — la vidéo n'a rien par-dessus. Calée en bas,
 * comme le repos (au-dessus du bord de la zone, ou des boutons du héros).
 */
export const PREVIEW_ZONE_WATCH = {
  /** L'écart entre la colonne et le bord gauche de la vidéo. */
  gutter: 28,
  gap: 10,
  meta: 30,
  /** Une ligne de la description courte (sa police : 23, interligne 31). */
  synopsisLine: 31,
  /** L'indice de la télécommande : deux lignes de 26 (un geste par ligne, jamais coupé). */
  hint: 52,
  /** Le logo : sa plus grande et sa plus petite hauteur. */
  logoMax: 92,
  logoMin: 56,
  /** Les lignes de la description, au plus. */
  maxLines: 3,
} as const;

export interface PreviewZoneWatchLayout {
  /** La largeur de la colonne. */
  width: number;
  logoMaxHeight: number;
  /** Les lignes de la description (0 : pas de description). */
  synopsisLines: number;
  /** Le bas de la colonne, depuis le bas de la zone. */
  bottom: number;
}

const W = PREVIEW_ZONE_WATCH;
const T = PREVIEW_ZONE_TEXT;

/**
 * La colonne de la version allégée. La place se partage dans cet ordre : le
 * logo à sa taille, l'indice et la méta toujours, la description perd des
 * lignes (jusqu'à aucune), puis le logo descend à sa plus petite taille.
 */
export function previewZoneWatchLayout(input: { hero: boolean; synopsis: boolean; left: number; mediaLeft: number }): PreviewZoneWatchLayout {
  const width = Math.max(0, input.mediaLeft - W.gutter - input.left);
  const bottom = input.hero ? T.bottom + T.heroActions + T.heroActionsGap : T.bottom;
  const available = PREVIEW_ZONE_HEIGHT - T.safeTop - bottom;
  const fixed = W.gap + W.meta + W.gap + W.hint;
  const height = (logo: number, lines: number) => logo + fixed + (lines > 0 ? W.gap + lines * W.synopsisLine : 0);
  const maxLines = input.synopsis ? W.maxLines : 0;
  for (let lines = maxLines; lines >= 0; lines -= 1) {
    if (height(W.logoMax, lines) <= available) return { width, logoMaxHeight: W.logoMax, synopsisLines: lines, bottom };
  }
  return { width, logoMaxHeight: Math.max(W.logoMin, Math.min(W.logoMax, available - fixed)), synopsisLines: 0, bottom };
}

/**
 * L'INDICE de la télécommande pendant l'aperçu (« Lecture/Pause : pause ·
 * maintenir : couper le son ») : dans la colonne allégée, jamais sur l'image.
 * Il se lit au départ de l'aperçu, puis s'efface — façon Apple TV+ : un
 * indice qui reste devient du bruit. Il revient, le même temps, à chaque
 * geste qui change ce qu'il dit (pause, reprise, son coupé ou remis), et
 * reste tant que l'aperçu est EN PAUSE : c'est là qu'on cherche comment
 * reprendre.
 */
export const PREVIEW_ZONE_HINT = {
  /** Le temps de lecture, depuis le départ de l'aperçu ou le dernier geste. */
  shownMs: 4000,
  /** Son effacement. */
  fadeOutMs: 600,
} as const;

/** L'indice se montre : en pause, ou moins de `shownMs` après `since` (départ, dernier geste). */
export function previewZoneHintShown(input: { paused: boolean; since: number | null; now: number }): boolean {
  if (input.paused) return true;
  return input.since !== null && input.now - input.since < PREVIEW_ZONE_HINT.shownMs;
}

/** Ce qu'il reste (ms) avant que l'indice s'efface ; 0 s'il est déjà parti ou sans départ. */
export function previewZoneHintLeft(since: number | null, now: number): number {
  return since === null ? 0 : Math.max(0, since + PREVIEW_ZONE_HINT.shownMs - now);
}
