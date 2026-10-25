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

/**
 * Une écoute que le lecteur DÉCLARE lui-même (capacité `sessions.musicControl`) :
 * la musique d'Octave. Un titre de la bibliothèque a déjà sa session chez
 * Jellyfin (rapports HTTP) — la déclaration y ajoute la position à la seconde
 * et désigne LE lecteur que vise une commande. Une lecture d'EXTENSION (hors
 * bibliothèque) n'existe pas pour Jellyfin : la déclaration est sa seule
 * trace, et le tableau de bord la commande par le canal.
 */
export interface DeclaredPlaybackDto {
  /** Clé stable du titre chez le lecteur (`jf:<id>`, `ext:<extension>:<id>`). */
  key: string;
  /** Titre de la bibliothèque : son élément Jellyfin. Absent : lecture d'extension. */
  itemId?: string;
  title: string;
  /** Les artistes, déjà joints (« A, B »). */
  artists?: string;
  album?: string;
  /** Pochette : un chemin du serveur Tentacle (`/api/…`) ou une adresse https publique. */
  imageUrl?: string;
  durationMs?: number;
  positionMs: number;
  isPaused: boolean;
}

/** Messages du lecteur vers le backend. */
export type SessionClientMessage =
  /** Ce lecteur sait parler par le canal. `deviceId` n'est qu'une étiquette
   *  de corrélation : le backend ne le présente JAMAIS à Jellyfin (qui
   *  réattribue une session à quiconque annonce son identifiant). `client`,
   *  `device` et `appVersion` nomment l'application d'un appareil JUMELÉ : le
   *  backend les présente avec l'identifiant qu'il dérive lui-même pour cet
   *  appareil, jamais avec `deviceId`. */
  | {
      type: "session:hello";
      version: number;
      deviceId?: string;
      client?: string;
      device?: string;
      appVersion?: string;
    }
  /** `resumed` : la lecture était déjà en cours (reconnexion, canal ouvert en
   *  cours de route) — le backend la reprend sans annoncer un nouveau début. */
  | { type: "playback:start"; state: PlaybackStateDto; resumed?: boolean }
  | { type: "playback:progress"; event: PlaybackEventDto; state: PlaybackStateDto }
  /** Fin de lecture ; `playback:stopped` répond une fois Jellyfin servi. */
  | { type: "playback:stop"; state: PlaybackStateDto; requestId: string }
  /** L'écoute déclarée de ce lecteur ; `null` : plus rien ne joue. Un serveur
   *  d'avant l'ignore (le lecteur ne l'envoie que face à `sessions.musicControl`). */
  | { type: "playback:declare"; state: DeclaredPlaybackDto | null };

/**
 * L'état de Jellyfin vu par le backend (`jellyfinHealth.ts`) : `up` il sert ;
 * `restarting` / `shutting-down` il l'a annoncé sur sa socket ; `down` il ne
 * répond plus ; `starting` il répond « en cours de chargement ».
 */
export type JellyfinHealthState = "up" | "restarting" | "shutting-down" | "down" | "starting";

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
  | { type: "playback:stopped"; requestId: string; ok: boolean }
  /**
   * Jellyfin change d'état — envoyé à chaque changement, et juste après
   * chaque `session:ready` (même `up` : une reconnexion efface un état
   * périmé). `since` : l'heure du serveur (ms) où l'état a commencé.
   * Additif : un lecteur qui ne le connaît pas l'ignore (pas de `minServer`).
   */
  | { type: "server:jellyfin"; state: JellyfinHealthState; since: number };
