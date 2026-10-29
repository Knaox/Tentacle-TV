/**
 * Octave — la musique EN DIRECT : les évènements `music:*` du socket partagé
 * (`/api/ws`) relisent ce qu'ils rendent faux, sans rien recharger d'autre.
 *
 * - `music:library` : un titre est arrivé, a changé ou est parti → listes,
 *   recherche, accueil ; un titre retiré perd aussi sa source en cache.
 * - `music:userdata` : le cœur a changé ailleurs (un autre appareil, l'interface
 *   de Jellyfin) → posé dans tout le cache, « Titres likés » relu.
 * - `music:playlist` : cette playlist et la liste des playlists.
 * - `music:listPrefs` : le tri d'une liste gardé par un AUTRE appareil du compte.
 * - `music:resolved` / `music:pending` (extensions) : un titre en attente a son
 *   élément → titres likés, playlists, accueil, et ce que la bibliothèque a
 *   parmi les titres montrés d'ailleurs (`match`).
 * Au retour du socket après une coupure : tout ce qui est musique se relit.
 * Un seul montage par application suffit.
 */

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { WsServerMessage } from "@tentacle-tv/shared";
import type { MusicEvent } from "@tentacle-tv/shared/music";
import { acquireSocket, onSocketStatus, subscribeSocket, type SocketStatus } from "../socket/tentacleSocket";
import { LIBRARY_SCOPES, MUSIC_KEY, musicKeys } from "./musicQueryKeys";
import { patchFavorites } from "./useMusicFavorite";
import { useMusicCapability } from "./useMusicLibrary";
import { isSavingListPrefs } from "./useMusicListOrder";

function invalidateScopes(qc: QueryClient, scopes: readonly string[]): void {
  for (const scope of scopes) void qc.invalidateQueries({ queryKey: ["music", scope] });
}

/** Pur (le client de requêtes injecté) : ce qu'un évènement relit. */
export function applyMusicEvent(qc: QueryClient, event: MusicEvent): void {
  switch (event.type) {
    case "music:library":
      for (const id of event.removed) qc.removeQueries({ queryKey: musicKeys.source(id) });
      for (const item of event.updated) void qc.invalidateQueries({ queryKey: musicKeys.source(item.jellyfinId) });
      invalidateScopes(qc, LIBRARY_SCOPES);
      void qc.invalidateQueries({ queryKey: ["music", "playlist"] });
      return;
    case "music:userdata":
      patchFavorites(qc, new Map(event.changes.map((c) => [c.jellyfinId, c.favorite])));
      invalidateScopes(qc, ["liked", "shelves"]);
      return;
    case "music:playlist":
      void qc.invalidateQueries({ queryKey: musicKeys.playlist(event.playlistId) });
      invalidateScopes(qc, ["playlists", "home", "shelves"]);
      return;
    case "music:resolved":
    case "music:pending":
      invalidateScopes(qc, ["liked", "playlists", "playlist", "home", "match"]);
      return;
    case "music:shelves":
      // Un autre appareil du compte a posé un favori ou rangé une rubrique ; l'écho de NOTRE ordre ne relit rien.
      if (!isSavingListPrefs(`library:${event.section}`)) void qc.invalidateQueries({ queryKey: musicKeys.shelves() });
      return;
    case "music:listPrefs":
      // Un autre appareil du compte a trié ou glissé cette liste ; l'écho de NOTRE envoi ne relit rien.
      if (!isSavingListPrefs(event.key)) void qc.invalidateQueries({ queryKey: musicKeys.listPrefs(event.key) });
      return;
    case "music:provider":
      // L'extension elle-même (`/api/plugins/active`) se relit ailleurs ; ici, ce qu'elle mêlait.
      // Les favoris d'une extension coupée (ou rallumée) disparaissent (ou reviennent) de la bibliothèque.
      invalidateScopes(qc, ["liked", "playlist", "shelves"]);
      return;
  }
}

function isMusicEvent(msg: WsServerMessage): msg is MusicEvent {
  return typeof msg.type === "string" && msg.type.startsWith("music:");
}

export interface UseMusicLiveOptions {
  /** Auth par message (bureau, mobile, TV) ; `undefined` = cookie (web). */
  token?: string | null;
  enabled?: boolean;
}

export function useMusicLive(options: UseMusicLiveOptions = {}): void {
  const { token, enabled = true } = options;
  const capable = useMusicCapability();
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !capable) return;
    const release = acquireSocket(token ?? undefined);
    const offMessage = subscribeSocket((msg: WsServerMessage) => {
      if (isMusicEvent(msg)) applyMusicEvent(qc, msg);
    });
    let hadOpen = false;
    let previous: SocketStatus | null = null;
    const offStatus = onSocketStatus((status) => {
      // Une coupure a pu faire manquer des évènements : rattrapage, une fois par retour.
      if (status === "open" && hadOpen && previous !== "open") void qc.invalidateQueries({ queryKey: [...MUSIC_KEY] });
      if (status === "open") hadOpen = true;
      previous = status;
    });
    return () => {
      offMessage();
      offStatus();
      release();
    };
  }, [enabled, capable, token, qc]);
}
