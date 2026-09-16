/**
 * Le temps de hls.js n'est pas le temps du film.
 *
 * # Ce qu'on a mesuré (16 septembre 2026)
 *
 * Un transcodage relancé en cours de film — changement de qualité, de piste,
 * incrustation, arrivée dans une salle au milieu d'un épisode — fait demander à
 * hls.js le segment N de la playlist, annoncé à N × 3 s. Jellyfin relance ffmpeg
 * avec `-ss N × 3 -copyts`, mais la recherche dans le conteneur atterrit sur
 * une image clé voisine : sur les fichiers du dépôt, la SUIVANTE, dix secondes
 * plus loin. Le segment N porte donc les horodatages de N × 3 + 10 s, et tous
 * ceux qui suivent aussi.
 *
 * hls.js ne s'en émeut pas : il retient `initPTS = premier PTS − heure
 * playlist du premier fragment` et le retranche à toute la session par le
 * `timestampOffset` des tampons. `video.currentTime` vaut alors l'heure de la
 * playlist, pas celle du contenu : le lecteur annonce 491 s en montrant l'image
 * de 500 s. La barre ment, la progression envoyée au serveur ment, et deux
 * membres d'une séance synchronisés au centième de seconde ne regardent pas
 * la même image — c'est ce que l'utilisateur voyait comme « un gros décalage
 * dès que l'un des deux transcode ».
 *
 * # La règle
 *
 * La position du film vaut `currentTime + atterrissage`, où l'atterrissage est
 * `initPTS − base`, la base étant l'horodatage de départ du conteneur (zéro
 * pour presque tout, 677 s sur un enregistrement de diffusion du dépôt). Une
 * session partie du segment 0 n'a pas cherché : son `initPTS` EST la base, et
 * on la retient pour les rechargements suivants du même média. Sans base
 * connue on suppose zéro — et un `initPTS` au-delà de ce qu'une image clé peut
 * expliquer (HLS_LANDING_MAX_S) trahit une base inconnue : on ne corrige rien,
 * c'est le comportement d'avant, jamais pire.
 *
 * # Le replacement, et les sauts hors de la passe
 *
 * Une session partie dix secondes trop loin ne se rattrape pas en y restant :
 * revenir en arrière dans la même session fait relancer ffmpeg au bon segment,
 * mais Jellyfin sert alors les fichiers que la première passe a laissés sur le
 * disque, hls.js les garde en tampon, et deux encodages se côtoient — le
 * décodeur vidéo s'arrête à leur frontière (image figée, son maintenu ;
 * reproduit deux fois sur deux le 16 septembre 2026, jamais avec une seule
 * passe). Dès que le premier fragment est en tampon et que la session est en
 * avance d'au moins HLS_RELOCATE_MIN_S sur sa cible, on renégocie donc une
 * session NEUVE (nouveau `PlaySessionId`, dossier vierge) à `cible −
 * atterrissage` — le chemin de niveau 3 de `useSmartSeek`, pas un vidage de
 * tampon : les restes de l'ancienne passe ne peuvent pas la contaminer. Les
 * sessions suivantes du même média partent directement au bon endroit et ne
 * se replacent plus. Pour la même raison, un saut avant le début de la passe
 * en cours, ou loin devant ce qui est chargé, renégocie lui aussi une session
 * neuve (`hlsSeekOutsideRun`).
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
/** Une session neuve part un segment AVANT sa cible : l'avance audio de la
 *  première passe varie de deux à quatre secondes d'un segment à l'autre, et
 *  atterrir devant la cible obligerait à reculer — donc à relancer ffmpeg
 *  dans la session, ce qu'on évite justement. Derrière la cible, on avance
 *  dans la passe, sans danger. */
export const HLS_START_MARGIN_S = 3;
/** Retard sur la cible à partir duquel on avance jusqu'à elle au premier fragment. */
export const HLS_CATCH_UP_MIN_S = 0.5;

/** Où faire partir une session hls.js (temps élément) pour reprendre `targetFilmS`. */
export function hlsSessionStart(targetFilmS: number, landingS: number): number {
  return Math.max(0, targetFilmS - landingS - HLS_START_MARGIN_S);
}

/** Un saut à moins de ça devant le tampon reste dans la passe : hls.js demande
 *  le segment suivant et Jellyfin le sert dès qu'il est produit. Au-delà,
 *  Jellyfin relancerait ffmpeg dans la même session — donc session neuve. */
export const HLS_ADJACENT_S = 6;

/**
 * Un saut (temps élément) sort-il de la passe ffmpeg en cours ? `runStartS` :
 * début de la passe (heure playlist du premier fragment de la session) ;
 * `bufferEndS` : fin du tampon, null s'il est vide.
 */
export function hlsSeekOutsideRun(targetS: number, runStartS: number, bufferEndS: number | null): boolean {
  if (targetS < runStartS) return true;
  return bufferEndS !== null && targetS > bufferEndS + HLS_ADJACENT_S;
}

export interface HlsTimelineInput {
  /** `initPTS / timescale` de hls.js : premier PTS − heure playlist du fragment (s). */
  initPtsS: number;
  /** Numéro du premier fragment de la session : 0 = début du média, sans recherche. */
  firstFragmentSn: number;
  /** Base d'horodatage apprise sur ce média, ou null. */
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
    return { landingS: 0, baseS: input.initPtsS, reason: "start" };
  }
  const base = input.knownBaseS ?? 0;
  const landing = input.initPtsS - base;
  if (!Number.isFinite(landing) || Math.abs(landing) > HLS_LANDING_MAX_S) {
    return { landingS: 0, baseS: input.knownBaseS, reason: "unknown-base" };
  }
  return { landingS: landing, baseS: input.knownBaseS, reason: "landing" };
}

