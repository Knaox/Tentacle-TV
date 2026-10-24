/**
 * Ce que les deux moteurs (mpv natif, `<audio>` du web) partagent : l'adresse
 * authentifiée d'une source, la clé d'album (ReplayGain « auto »), l'état de
 * repos et la diffusion des évènements. Pur, sans DOM (`engineShared.test.ts`).
 */

import type { EngineEvent, EngineState, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";

/** De quoi joindre le serveur Tentacle, tel que le client Jellyfin de la page le sait. */
export interface MusicEngineAuth {
  /** L'adresse du serveur Tentacle (`getBackendBase()`), vide si même origine. */
  baseUrl: string;
  token: string | null;
  /** Session par cookie (le web) : le navigateur authentifie seul. */
  useCredentials: boolean;
}

/**
 * L'adresse ABSOLUE d'une source. `PlaybackSource.url` est toujours un chemin
 * du serveur Tentacle (`/api/music/stream/…`, `/api/plugins/<id>/…`).
 */
export function absoluteSourceUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Les en-têtes que le moteur natif pose sur chacune de ses requêtes (comme `client.fetch`). */
export function engineHeaders(auth: MusicEngineAuth): Record<string, string> {
  return auth.token !== null && auth.token !== "" ? { "X-Emby-Token": auth.token } : {};
}

/**
 * L'adresse que lit un `<audio>`, qui ne sait pas poser d'en-tête : avec une
 * session par cookie, l'adresse telle quelle ; sinon le jeton en `api_key`,
 * la convention des balises sans en-têtes (`beaconUrl`, api-client).
 */
export function elementSourceUrl(url: string, auth: MusicEngineAuth): string {
  const absolute = absoluteSourceUrl(url, auth.baseUrl);
  if (auth.useCredentials || auth.token === null || auth.token === "") return absolute;
  return `${absolute}${absolute.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(auth.token)}`;
}

/** La clé d'album d'un titre : l'élément Jellyfin, sinon le MBID, sinon titre + artiste. */
export function albumKeyOf(track: MusicTrack): string | null {
  const album = track.album;
  if (album === null) return null;
  return album.jellyfinId ?? album.mbid ?? `${album.title}|${track.artists[0]?.name ?? ""}`;
}

/** La durée la mieux connue : celle de la source, puis celle du titre. */
export function durationOfSource(track: MusicTrack, source: PlaybackSource): number | null {
  return source.durationMs ?? track.durationMs;
}

export function idleState(volume: number, muted: boolean): EngineState {
  return {
    status: "idle",
    trackKey: null,
    positionMs: 0,
    durationMs: null,
    volume,
    muted,
    format: null,
    output: { deviceId: null, exclusive: false },
    error: null,
  };
}

/** La position extrapolée entre deux états : seulement en lecture, jamais au-delà de la durée. */
export function extrapolatedPosition(state: EngineState, measuredAt: number, now: number): number {
  if (state.status !== "playing") return state.positionMs;
  const position = state.positionMs + Math.max(0, now - measuredAt);
  return state.durationMs === null ? position : Math.min(position, state.durationMs);
}

/** Les abonnés d'un moteur : un abonné qui lève ne prive pas les autres. */
export class EngineEmitter {
  private readonly listeners = new Set<(event: EngineEvent) => void>();

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[music-engine] abonné en échec", error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
