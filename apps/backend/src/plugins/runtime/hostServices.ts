import type { AudioItemRef, HostApi, HostMethod } from "./pluginServerRuntime";

/**
 * Ce que le runtime EMPRUNTE au reste du cœur, injecté au démarrage
 * (`configureIsolatedRuntime`, appelé par `index.ts`) : la musique Jellyfin
 * (`music/host/jellyfinMusicHost.ts`), l'envoi des événements `music:*` aux
 * comptes (`music/events/musicSend.ts`) et le flux des éléments audio vus
 * (`music/events/audioItemsFeed.ts`). Le runtime n'en réimplémente rien : il
 * garde la porte (familles, droits, Zod) et relaie.
 *
 * Sans service branché : `jellyfin.*` répond `unavailable`, aucun événement ne
 * part, aucun élément audio n'est poussé — fermé, jamais à moitié.
 */

type JellyfinMethod = Extract<HostMethod, `jellyfin.${string}`>;

/** Les méthodes `jellyfin.*` du contrat, sous leur nom court, aux mêmes paramètres et résultats. */
export type JellyfinMusicHost = {
  [M in JellyfinMethod as M extends `jellyfin.${infer Name}` ? Name : never]: (params: HostApi[M]["params"]) => Promise<HostApi[M]["result"]>;
};

/** Les événements que le runtime fait partir (forme du contrat `musicEvents.ts` de shared). */
export type RuntimeMusicEvent =
  | { type: "music:resolved"; pluginId: string; externalId: string; jellyfinId: string; recording: string | null; track: unknown }
  | { type: "music:pending"; pluginId: string }
  | { type: "music:provider" };

export interface AudioItemsChange {
  added: AudioItemRef[];
  updated: AudioItemRef[];
  removed: string[];
}

export interface IsolatedRuntimeServices {
  jellyfin: JellyfinMusicHost | null;
  /** Aux comptes nommés ; rend le nombre de comptes connectés servis. */
  sendMusicEvent: (userIds: readonly string[], event: RuntimeMusicEvent) => number;
  /** À tous les comptes connectés (`music:provider`). */
  broadcastMusicEvent: (event: RuntimeMusicEvent) => number;
  onAudioItems: ((listener: (change: AudioItemsChange) => void) => () => void) | null;
  /**
   * Le titre de la bibliothèque tel que CE compte le voit (index du cœur), pour `music:resolved` : Jellyfin fait foi,
   * pochette comprise (26/10). `null` : pas (encore) indexé, ou invisible au compte — le titre de l'extension reste.
   */
  libraryTrack: ((userId: string, jellyfinId: string) => Promise<unknown | null>) | null;
}

const NONE: IsolatedRuntimeServices = {
  jellyfin: null,
  sendMusicEvent: () => 0,
  broadcastMusicEvent: () => 0,
  onAudioItems: null,
  libraryTrack: null,
};

let services: IsolatedRuntimeServices = NONE;

/** Branche (ou remplace) des services ; ce qui n'est pas passé reste tel quel. */
export function configureIsolatedRuntime(next: Partial<IsolatedRuntimeServices>): void {
  services = { ...services, ...next };
}

export function runtimeServices(): IsolatedRuntimeServices {
  return services;
}

/** Pour les tests : retour à « rien de branché ». */
export function resetRuntimeServicesForTests(): void {
  services = NONE;
}
