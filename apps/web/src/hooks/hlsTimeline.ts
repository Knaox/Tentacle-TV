/**
 * Le temps de hls.js et le temps du film.
 *
 * # Ce qu'on a mesuré (16 septembre 2026, ffprobe sur les segments de Jellyfin 10.11)
 *
 * Chaque segment d'un transcodage HLS Jellyfin porte des horodatages décalés de
 * DIX secondes par rapport à l'heure de la playlist : le segment 0 (0 s) contient
 * de l'audio à 10,000 s, le segment 166 (498 s) à 507,957 s, le 200 (600 s) à
 * 609,957 s — sur deux fichiers dont le conteneur part de zéro. C'est le muxeur
 * MPEG-TS de ffmpeg : sans `-mpegts_copyts 1`, il ajoute 2 × `max_delay` à tous
 * les horodatages, et Jellyfin passe `-max_delay 5000000`. Le décalage est
 * CONSTANT pour tout le média, quel que soit le segment demandé ; l'`-ss` de
 * Jellyfin, lui, est précis à l'image (la vidéo suit l'audio de 40 à 100 ms,
 * pas d'une image clé).
 *
 * hls.js absorbe ce décalage : il retient `initPTS = premier PTS − heure playlist
 * du premier fragment` — dix secondes ici, quel que soit le fragment — et le
 * retranche à toute la session. `video.currentTime` vaut donc l'heure de la
 * playlist, c'est-à-dire la position du FILM. Rien à corriger.
 *
 * # Ce qu'une version d'un jour avait cru voir
 *
 * Ces dix secondes ont été prises pour un atterrissage d'image clé propre à
 * chaque session (« le ffmpeg relancé part de l'image clé suivante ») et
 * AJOUTÉES à `currentTime` : toute session qui ne partait pas du segment 0
 * affichait et rapportait dix secondes de trop — un épisode de 22 min 39
 * « finissait » à 22 min 49, et en séance le lecteur web se calait dix secondes
 * derrière un lecteur de bureau, dont mpv rebase ses temps sur le premier
 * segment lu. Deux onglets web, faux du même montant, paraissaient parfaitement
 * synchrones. Jamais commis sur `main`.
 *
 * # La règle
 *
 * Sans référence, on ne corrige RIEN : `currentTime` est la position du film.
 * Une session partie du segment 0 n'a pas cherché : son `initPTS` est le
 * décalage du muxeur (plus la base d'un conteneur qui ne part pas de zéro —
 * 677 s sur un enregistrement de diffusion du dépôt), et on le retient comme
 * BASE pour le média. Dès lors, l'écart entre l'`initPTS` d'une session
 * ultérieure et cette base est un vrai atterrissage — l'audio coupé à une trame
 * AAC avant la cible (−43 ms mesurés), ou une image clé plus loin chez un
 * serveur dont l'`-ss` ne serait pas précis — et il se corrige. Un écart
 * qu'aucune image clé n'explique (HLS_LANDING_MAX_S) laisse tout en place.
 *
 * # Le replacement, et les sauts hors de la passe
 *
 * Une session qui atterrit en avance sur sa cible ne se rattrape pas en y
 * restant : revenir en arrière dans la même session fait relancer ffmpeg au bon
 * segment, mais Jellyfin sert alors les fichiers que la première passe a
 * laissés sur le disque, hls.js les garde en tampon, et deux encodages se
 * côtoient — le décodeur vidéo s'arrête à leur frontière (image figée, son
 * maintenu ; reproduit deux fois sur deux le 16 septembre 2026, jamais avec une
 * seule passe). Dès que le premier fragment est en tampon et que la session est
 * en avance d'au moins HLS_RELOCATE_MIN_S sur sa cible, on renégocie donc une
 * session NEUVE (nouveau `PlaySessionId`, dossier vierge) à `cible −
 * atterrissage` — le chemin de niveau 3 de `useSmartSeek`, pas un vidage de
 * tampon. Pour la même raison, un saut AVANT le début de la passe en cours
 * renégocie lui aussi une session neuve (`hlsSeekOutsideRun`). Un saut en
 * avant, lui, reste dans la session : Jellyfin relance ffmpeg au segment
 * demandé, les fichiers de la passe précédente sont tous derrière, et le
 * lecteur garde son état — c'est ce qui compte en séance, où la barrière d'un
 * saut de passage l'a mis en pause : une session neuve relançait la lecture
 * d'elle-même et il n'était plus jamais posé sur la cible.
 *
 * La décision est pure et testée sans lecteur ; `attachHlsTimeline`
 * (`hlsTimelineAttach.ts`) la branche sur une instance hls.js.
 */


/**
 * Au-delà, ce n'est pas un atterrissage d'image clé mais une base d'horodatage
 * qu'on ne connaît pas. Les intervalles d'images clés courants vont de deux à
 * dix secondes ; les bases d'un flux de diffusion se comptent en milliers.
 */
export const HLS_LANDING_MAX_S = 45;

/** Avance minimale sur la cible pour renégocier une session : en dessous, la
 *  boucle de dérive (ou un saut en avant, sans danger) s'en charge. */
export const HLS_RELOCATE_MIN_S = 1.5;
/** Replacements par montage : au-delà, on garde la session telle quelle. */
export const HLS_RELOCATE_MAX = 2;
/** Quand un atterrissage POSITIF est connu, une session neuve part un segment
 *  avant sa cible : atterrir devant elle obligerait à reculer — donc à relancer
 *  ffmpeg dans la session, ce qu'on évite justement. Derrière la cible, on
 *  avance dans la passe, sans danger. Sans atterrissage, on vise la cible. */
export const HLS_START_MARGIN_S = 3;
/** Retard sur la cible à partir duquel on avance jusqu'à elle au premier fragment. */
export const HLS_CATCH_UP_MIN_S = 0.5;

/** Où faire partir une session hls.js (temps élément) pour reprendre `targetFilmS`. */
export function hlsSessionStart(targetFilmS: number, landingS: number): number {
  // Rien à absorber : partir plus tôt ne ferait que charger un segment de plus
  // pour sauter ensuite. (Un atterrissage négatif se retranche tel quel.)
  if (!(landingS > 0)) return Math.max(0, targetFilmS - (Number.isFinite(landingS) ? landingS : 0));
  return Math.max(0, targetFilmS - landingS - HLS_START_MARGIN_S);
}

/**
 * Un saut (temps élément) sort-il de la passe ffmpeg en cours — c'est-à-dire
 * revient-il AVANT son début ? `runStartS` : heure playlist du premier
 * fragment de la session. En avant, la session tient (voir l'en-tête).
 */
export function hlsSeekOutsideRun(targetS: number, runStartS: number): boolean {
  return targetS < runStartS;
}

export interface HlsTimelineInput {
  /** `initPTS / timescale` de hls.js : premier PTS − heure playlist du fragment (s). */
  initPtsS: number;
  /** Numéro du premier fragment de la session : 0 = début du média, sans recherche. */
  firstFragmentSn: number;
  /** Base d'horodatage apprise sur ce média (initPTS d'une session partie du
   *  segment 0 : décalage du muxeur + base du conteneur), ou null. */
  knownBaseS: number | null;
}

export interface HlsTimelineDecision {
  /** À AJOUTER à `currentTime` pour obtenir la position du film (s). */
  landingS: number;
  /** La base à retenir pour les sessions suivantes du même média. */
  baseS: number | null;
  reason: "start" | "landing" | "unknown-base";
}

export function decideHlsTimeline(input: HlsTimelineInput): HlsTimelineDecision {
  if (input.firstFragmentSn === 0) {
    return { landingS: 0, baseS: Number.isFinite(input.initPtsS) ? input.initPtsS : null, reason: "start" };
  }
  // Sans base connue, l'initPTS est le décalage du muxeur — pas un atterrissage.
  if (input.knownBaseS === null) return { landingS: 0, baseS: null, reason: "unknown-base" };
  const landing = input.initPtsS - input.knownBaseS;
  if (!Number.isFinite(landing) || Math.abs(landing) > HLS_LANDING_MAX_S) {
    return { landingS: 0, baseS: input.knownBaseS, reason: "unknown-base" };
  }
  return { landingS: landing, baseS: input.knownBaseS, reason: "landing" };
}

