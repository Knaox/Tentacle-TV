import { NativeModules } from "react-native";

/**
 * Ce que le lecteur a chargé (module natif `TentaclePlayerProbe` : AVPlayer
 * sur tvOS, `ios/TentacleTV/PlayerLoadProbe.m` ; ExoPlayer ou mpv sur Android
 * TV, `probe/PlayerLoadProbe.kt`) : le seul signe, pendant une ouverture ou
 * un arrêt, que des données ARRIVENT. `null` sans lecteur monté, ou sous un
 * natif plus ancien que la sonde : la reprise retombe alors sur la position
 * et la mémoire vues en lecture. mpv ne compte pas les octets : sa mémoire
 * (`loadedEnd`) qui avance suffit (`loadGrew`).
 */
export interface PlayerLoad {
  /** La fin la plus lointaine de ce qui est chargé, en secondes. */
  loadedEnd: number;
  /** Octets reçus depuis l'ouverture de l'élément. */
  bytes: number;
  requests: number;
  ready: boolean;
  /** Diagnostic : élément en échec, vitesse, état de lecture (0 pause, 1 attente,
   *  2 lecture), raison de l'attente, tampon « suffisant » et plein. */
  failed?: boolean;
  rate?: number;
  control?: number;
  waiting?: string;
  keepUp?: boolean;
  full?: boolean;
}

const probe = NativeModules.TentaclePlayerProbe as { loadState?: () => Promise<PlayerLoad | null> } | undefined;

export function readPlayerLoad(): Promise<PlayerLoad | null> {
  if (!probe?.loadState) return Promise.resolve(null);
  return probe.loadState().catch(() => null);
}

/** Des données sont-elles arrivées depuis la lecture d'avant ? La première
 *  lecture ne fait que poser la base : on ne sait pas QUAND ses octets sont venus. */
export function loadGrew(previous: PlayerLoad | null, next: PlayerLoad | null): boolean {
  if (!previous || !next) return false;
  return next.bytes > previous.bytes || next.loadedEnd > previous.loadedEnd + 0.5;
}
