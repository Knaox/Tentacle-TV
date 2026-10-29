/**
 * Octave — les événements temps réel de la musique, portés par le CANAL DE
 * SESSION existant du cœur (le même que `server:jellyfin`), additifs : un
 * client qui ne les connaît pas les ignore (contrat, docs/octave/CONTRATS.md).
 *
 * Le cœur les tire des sockets Jellyfin des COMPTES (services/jellyfinUserEvents.ts :
 * `LibraryChanged`, `UserDataChanged`) — jamais d'un relevé.
 */

import type { MusicShelfSection } from "./musicLibraryShelves";
import type { MusicListKey } from "./musicListOrder";
import type { Mbid, MusicTrack } from "./musicTypes";

export const MUSIC_EVENT_TYPES = [
  "music:library",
  "music:userdata",
  "music:playlist",
  "music:resolved",
  "music:pending",
  "music:provider",
  "music:listPrefs",
  "music:shelves",
] as const;

export type MusicEventType = (typeof MUSIC_EVENT_TYPES)[number];

/** Des éléments audio sont apparus, ont changé ou sont partis (bibliothèque). Émis par le CŒUR. */
export interface MusicLibraryEvent {
  type: "music:library";
  added: { jellyfinId: string; recording: Mbid | null }[];
  updated: { jellyfinId: string; recording: Mbid | null }[];
  removed: string[];
}

/** Le favori du compte a changé (d'ici ou d'un autre client Jellyfin). Émis par le CŒUR. */
export interface MusicUserDataEvent {
  type: "music:userdata";
  changes: { jellyfinId: string; favorite: boolean }[];
}

/** Une playlist a changé (entrées, ordre, nom). Émis par le CŒUR. */
export interface MusicPlaylistEvent {
  type: "music:playlist";
  playlistId: string;
}

/**
 * Un titre hors bibliothèque a désormais son élément Jellyfin : les listes
 * remplacent l'entrée en attente, le lecteur BASCULE sa source (titre courant
 * et file) — `swapSource`. Émis par une EXTENSION (API d'hôte `events.emit`),
 * relayé tel quel aux comptes nommés.
 */
export interface MusicResolvedEvent {
  type: "music:resolved";
  pluginId: string;
  externalId: string;
  jellyfinId: string;
  recording: Mbid | null;
  track: MusicTrack | null;
}

/** Les entrées en attente du compte ont changé (ajout, échec, résolution). Émis par une EXTENSION. */
export interface MusicPendingEvent {
  type: "music:pending";
  pluginId: string;
}

/** Une extension musique est apparue, a été coupée ou a changé de droits : relire `/api/plugins/active`. Émis par le CŒUR. */
export interface MusicProviderEvent {
  type: "music:provider";
}

/**
 * Le tri ou l'ordre personnalisé d'une liste du compte a changé (un autre appareil l'a gardé) : relire sa
 * préférence. Émis par le CŒUR à chaque `PUT /api/music/lists/:key/prefs`, à tous les appareils du compte.
 */
export interface MusicListPrefsEvent {
  type: "music:listPrefs";
  key: MusicListKey;
}

/**
 * Les favoris ou l'ordre personnel d'une rubrique de la bibliothèque ont changé (un autre appareil du compte, ou un
 * favori hors bibliothèque) : relire `/api/music/library/shelves`. Émis par le CŒUR (`musicLibraryShelves.ts`).
 */
export interface MusicShelvesEvent {
  type: "music:shelves";
  section: MusicShelfSection;
}

export type MusicEvent =
  | MusicLibraryEvent
  | MusicUserDataEvent
  | MusicPlaylistEvent
  | MusicResolvedEvent
  | MusicPendingEvent
  | MusicProviderEvent
  | MusicListPrefsEvent
  | MusicShelvesEvent;

/** Les seuls types qu'une EXTENSION peut émettre par l'API d'hôte (le reste est refusé). */
export const PLUGIN_EMITTABLE_MUSIC_EVENTS = ["music:resolved", "music:pending"] as const;
