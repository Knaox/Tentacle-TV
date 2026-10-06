/**
 * Le VERROU DE DÉMARRAGE du lecteur : l'écran de chargement ne s'en va, et la
 * lecture ne part, que quand l'image ET le son sont prêts — d'un même geste.
 *
 * Retour d'essai (Android TV, Shield) : l'image tressautait, le chargement se
 * terminait, puis le son arrivait, puis l'image démarrait (ou l'inverse) — le
 * moteur jouait dès qu'il pouvait, et l'écran de chargement partait sur le
 * « prêt » du flux, avant que la première image soit posée.
 *
 * Un moteur qui ANNONCE sa première image (trait de la plateforme : ExoPlayer
 * `onRenderedFirstFrame` une fois prêt, mpv `playback-restart`) est tenu en
 * pause depuis l'ouverture ; il charge, pose sa première image sur la surface
 * (sous l'écran de chargement, opaque), et son « première image » ouvre le
 * verrou : l'écran s'en va et la pause se lève dans le même rendu — le son et
 * le mouvement partent ensemble, sur une image déjà là. Un moteur qui n'annonce
 * rien (l'AVPlayer de l'Apple TV) garde la règle d'avant.
 *
 * Filet : un moteur prêt dont la première image ne s'annonce pas (lecture
 * tunnelisée, flux sans image) ne retient pas l'écran au-delà de
 * `START_GATE_FALLBACK_MS`. Module pur, horloge injectée.
 */

/** Au-delà, depuis le « prêt » du flux, le verrou s'ouvre sans première image. */
export const START_GATE_FALLBACK_MS = 3000;

export interface StartGateState {
  /** Le moteur annonce sa première image (trait de la plateforme). */
  announcesFirstFrame: boolean;
  /** Le flux est prêt (`load`) depuis cet instant ; null : pas encore. */
  loadedAt: number | null;
  /** Le moteur a posé sa première image, son prêt. */
  firstFrame: boolean;
}

/** La lecture peut-elle se montrer — l'écran de chargement s'en aller ? Pour un
 *  moteur qui n'annonce rien, le « prêt » du flux suffit (la règle d'avant). */
export function startGateOpen(state: StartGateState, now: number): boolean {
  if (state.loadedAt === null) return false;
  if (!state.announcesFirstFrame || state.firstFrame) return true;
  return now - state.loadedAt >= START_GATE_FALLBACK_MS;
}

/** Le moteur est-il tenu en pause ? Oui tant que la lecture ne s'est pas
 *  montrée, s'il annonce sa première image ; jamais sinon. */
export function holdsStart(announcesFirstFrame: boolean, started: boolean): boolean {
  return announcesFirstFrame && !started;
}
