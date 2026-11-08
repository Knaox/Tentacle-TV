/**
 * Quand la sonde PÉRIODIQUE du magasin de connectivité se tait — module pur,
 * sans React Native, pour être testé seul.
 *
 * Chaque sonde réveille le modem (deux requêtes) : en 4G/5G, un réveil toutes
 * les ~10 s ou plus souvent et il ne s'endort jamais. Deux lectures en
 * dispensent :
 * - une vidéo GARDÉE (`isLocalPlaybackActive`) : elle ne doit rien au réseau,
 *   pas même la sonde ; l'arrêt et le premier plan re-sondent ;
 * - Octave qui JOUE, tant que le magasin se sait en ligne : le son avance, et
 *   ses propres requêtes (sources, rapport d'écoute) servent de sonde — tout
 *   échec y déclenche la sonde immédiate (`reportNetworkSuspect`, et le lecteur
 *   qui bloque ou échoue : `octave/player/listeningProbe.ts`). Hors ligne, la
 *   sonde à 15 s continue : c'est elle qui voit le serveur revenir.
 *
 * Seule la sonde PÉRIODIQUE se tait : le premier plan, un changement de réseau
 * ou une requête en échec sondent comme avant.
 */

export interface ProbeQuietInput {
  /** Une vidéo gardée sur l'appareil joue. */
  localPlayback: boolean;
  /** Octave joue (le son avance, ni en attente de données ni en échec). */
  musicPlaying: boolean;
  /** Joignabilité confirmée (état `online`). */
  online: boolean;
}

/** Ce tour de la sonde périodique est-il sauté ? */
export function skipPeriodicProbe(input: ProbeQuietInput): boolean {
  if (input.localPlayback) return true;
  return input.musicPlaying && input.online;
}

let musicPlaying = false;

/** Posé par le lecteur d'Octave (`followListeningForProbe`), relu à chaque tour de la sonde. */
export function setMusicPlaying(on: boolean): void {
  musicPlaying = on;
}

export const isMusicPlaying = (): boolean => musicPlaying;
