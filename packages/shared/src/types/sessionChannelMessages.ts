/**
 * Canal de session — le CONTRAT entre un lecteur (web, bureau) et le backend
 * pour l'état de lecture et la télécommande Jellyfin.
 *
 * Ce fichier est recopié octet pour octet dans le backend
 * (`apps/backend/src/services/deviceSessions/protocolMessages.ts`) : le
 * backend est compilé en CommonJS et exécuté depuis dist/, il ne peut pas
 * importer le package shared à l'exécution. Le test `protocolMirror.test.ts`
 * du backend tient les deux copies ensemble — on modifie ICI, on recopie
 * là-bas.
 *
 * Le principe : le lecteur parle au backend par le socket `/api/ws` qu'il
 * tient déjà — un message ne coûte rien à Jellyfin. C'est le backend qui
 * tient, pour chaque appareil, la connexion Jellyfin (télécommande, et fin
 * de session immédiate quand l'appareil disparaît) et qui décide quand un
 * report mérite une requête HTTP à Jellyfin.
 */

/** Version du canal annoncée par le client dans `session:hello`. */
export const SESSION_CHANNEL_VERSION = 1;

/** Méthode de lecture, au sens de Jellyfin (`PlayMethod`). */
export type PlayMethodDto = "DirectPlay" | "DirectStream" | "Transcode";

/** L'état d'une lecture, tel que le lecteur le connaît à l'instant de l'envoi. */
export interface PlaybackStateDto {
  itemId: string;
  mediaSourceId?: string;
  playSessionId?: string;
  playMethod: PlayMethodDto;
  positionTicks: number;
  isPaused: boolean;
  audioStreamIndex?: number;
  /** -1 = aucun sous-titre. */
  subtitleStreamIndex?: number;
  canSeek?: boolean;
  /** 0 à 100. */
  volumeLevel?: number;
  isMuted?: boolean;
}

/**
 * Pourquoi un report part. Un BORD (pause, reprise, saut, pistes, volume)
 * vaut une requête à Jellyfin ; un battement (`tick`) ne fait que tenir la
 * position du backend à jour — c'est elle qui part si l'appareil disparaît.
 */
export type PlaybackEventDto = "tick" | "pause" | "unpause" | "seek" | "tracks" | "volume";

/** Commandes de lecture transmises par Jellyfin (`PlaystateCommand`). */
export type SessionPlaystateCommandDto =
  | "Stop"
  | "Pause"
  | "Unpause"
  | "PlayPause"
  | "Seek"
  | "NextTrack"
  | "PreviousTrack"
  | "Rewind"
  | "FastForward";

/** Messages du lecteur vers le backend. */
export type SessionClientMessage =
  /** Ce lecteur sait parler par le canal. `deviceId` n'est qu'une étiquette
   *  de corrélation : le backend ne le présente JAMAIS à Jellyfin (qui
   *  réattribue une session à quiconque annonce son identifiant). */
  | { type: "session:hello"; version: number; deviceId?: string }
  /** `resumed` : la lecture était déjà en cours (reconnexion, canal ouvert en
   *  cours de route) — le backend la reprend sans annoncer un nouveau début. */
  | { type: "playback:start"; state: PlaybackStateDto; resumed?: boolean }
  | { type: "playback:progress"; event: PlaybackEventDto; state: PlaybackStateDto }
  /** Fin de lecture ; `playback:stopped` répond une fois Jellyfin servi. */
  | { type: "playback:stop"; state: PlaybackStateDto; requestId: string };

/** Messages du backend vers le lecteur. */
export type SessionServerMessage =
  /**
   * État du canal. `reporting` : le backend porte la télémétrie de cette
   * connexion — faux, le lecteur garde ses reports HTTP. `remoteControl` : la
   * connexion Jellyfin de l'appareil est ouverte (télécommande possible).
   * Renvoyé à chaque changement.
   */
  | { type: "session:ready"; reporting: boolean; remoteControl: boolean }
  | { type: "session:command"; command: SessionPlaystateCommandDto; seekPositionTicks?: number }
  /** Commande générale de Jellyfin (piste audio, sous-titres, volume…). */
  | { type: "session:general"; name: string; arguments: Record<string, string> }
  /** Message à afficher (`DisplayMessage` de Jellyfin, ou tableau de bord Tentacle). */
  | { type: "session:message"; header: string; text: string; timeoutMs?: number }
  | { type: "playback:stopped"; requestId: string; ok: boolean };
