/**
 * Le VERROU DE DÉMARRAGE du lecteur : l'écran de chargement ne s'en va que
 * quand l'image ET le son partent — d'un même geste.
 *
 * Retour d'essai (Android TV, Shield) : l'image tressautait, le chargement se
 * terminait, puis le son arrivait, puis l'image démarrait (ou l'inverse) — le
 * moteur jouait dès qu'il pouvait, et l'écran de chargement partait sur le
 * « prêt » du flux, avant que la première image soit posée.
 *
 * Un moteur qui ANNONCE sa première image (trait de la plateforme : ExoPlayer
 * `onRenderedFirstFrame` une fois prêt, mpv `playback-restart`) est tenu en
 * pause depuis l'ouverture ; il charge et pose sa première image sur la
 * surface, sous l'écran de chargement (opaque). Deux temps, ensuite :
 *
 * 1. la première image LÈVE LA PAUSE (`holdsStart`) ;
 * 2. l'écran s'en va (`startGateOpen`) quand le son part RÉELLEMENT — l'image
 *    suit l'horloge du son, elle reste figée tant qu'il n'est pas sorti (le
 *    passthrough vers l'ampli coûte ~200 ms, mesuré sur la Shield) : le
 *    mouvement et le son paraissent ensemble. Un moteur dont le son n'est pas
 *    annoncé à part (mpv : `playback-restart` dit déjà « image et son prêts »)
 *    ou un flux sans son lève l'écran avec la pause.
 *
 * Un moteur qui n'annonce rien (l'AVPlayer de l'Apple TV) garde la règle
 * d'avant. Filets : une première image qui ne s'annonce pas (lecture
 * tunnelisée) ne retient rien au-delà de `START_GATE_FALLBACK_MS` après le
 * « prêt » ; un son qui ne s'annonce pas, au-delà de `START_AUDIO_WAIT_MS`
 * après la première image. Module pur, horloge injectée.
 */

/** Au-delà, depuis le « prêt » du flux, le verrou s'ouvre sans première image. */
export const START_GATE_FALLBACK_MS = 3000;
/** Au-delà, depuis la première image, l'écran s'en va sans attendre le son. */
export const START_AUDIO_WAIT_MS = 1500;

export interface StartGateState {
  /** Le moteur annonce sa première image (trait de la plateforme). */
  announcesFirstFrame: boolean;
  /** Le flux est prêt (`load`) depuis cet instant ; null : pas encore. */
  loadedAt: number | null;
  /** La première image est posée (son prêt) depuis cet instant ; null : pas encore. */
  firstFrameAt: number | null;
  /** Le départ du son s'annoncera à part (Exo, flux avec son) : l'écran l'attend. */
  audioFollows: boolean;
  /** Le son est réellement sorti. */
  audioStarted: boolean;
}

/** Le moteur peut-il jouer — la pause du démarrage se lever ? À la première
 *  image, ou au filet si elle ne s'annonce pas. */
export function startReleased(state: StartGateState, now: number): boolean {
  if (state.loadedAt === null) return false;
  if (!state.announcesFirstFrame || state.firstFrameAt !== null) return true;
  return now - state.loadedAt >= START_GATE_FALLBACK_MS;
}

/** La lecture peut-elle se montrer — l'écran de chargement s'en aller ? Pour un
 *  moteur qui n'annonce rien, le « prêt » du flux suffit (la règle d'avant). */
export function startGateOpen(state: StartGateState, now: number): boolean {
  if (!startReleased(state, now)) return false;
  if (!state.announcesFirstFrame) return true;
  // Relâché au filet (aucune première image) : rien d'autre à attendre.
  if (state.firstFrameAt === null) return true;
  if (!state.audioFollows || state.audioStarted) return true;
  return now - state.firstFrameAt >= START_AUDIO_WAIT_MS;
}

/** Le moteur est-il tenu en pause ? Oui tant que le démarrage ne l'a pas
 *  relâché, s'il annonce sa première image ; jamais sinon. */
export function holdsStart(announcesFirstFrame: boolean, released: boolean): boolean {
  return announcesFirstFrame && !released;
}
