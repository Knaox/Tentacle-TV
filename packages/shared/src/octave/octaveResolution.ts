/**
 * Octave — un titre hors bibliothèque vient d'avoir son élément Jellyfin
 * (`music:resolved`). Sans geste de l'utilisateur :
 * - toutes ses entrées de la file deviennent le titre de la bibliothèque, à la même place ;
 * - le titre COURANT et le SUIVANT préchargé basculent leur source à chaud
 *   (`swapSource`), à la même position, sous la clé que le moteur connaît déjà.
 */

import { libraryTrackKey, type MusicResolvedEvent, type MusicTrack } from "../music";
import { currentItem, replaceTrack } from "./queueModel";
import type { OctavePlayer } from "./octavePlayer";

export function matchesExternal(track: MusicTrack, pluginId: string, externalId: string): boolean {
  return track.external?.pluginId === pluginId && track.external.id === externalId;
}

/** Le titre de la bibliothèque qui remplace l'externe : celui de l'événement, sinon l'externe requalifié. */
export function resolvedTrackOf(old: MusicTrack, event: MusicResolvedEvent): MusicTrack {
  if (event.track) return { ...event.track, favorite: event.track.favorite || old.favorite };
  return {
    ...old,
    key: libraryTrackKey(event.jellyfinId),
    jellyfinId: event.jellyfinId,
    availability: "library",
    mbids: { ...old.mbids, recording: event.recording ?? old.mbids.recording },
  };
}

/** Le moteur redemande une source (URL expirée, refusée) : le cache l'oublie, la nouvelle bascule à chaud. */
export function refreshEngineSource(player: OctavePlayer, engineKey: string): void {
  const item = player.snapshot.get().queue.items.find((i) => player.engineKeys.get(i.uid) === engineKey);
  if (!item) return;
  player.deps.sources.invalidate(item.track.key);
  void player.deps.sources.get(item.track).then((source) => {
    if (!source) return;
    player.deps.engine.swapSource(engineKey, { ...source, trackKey: engineKey });
    // D'où le lecteur lit : la copie gardée, ou de nouveau le serveur (une copie effacée entre-temps).
    const fromDevice = source.kept !== undefined;
    if (item.uid === player.nextUid) player.nextFromDevice = fromDevice;
    if (item.uid === currentItem(player.snapshot.get().queue)?.uid) player.snapshot.update({ fromDevice });
  });
}

export function applyResolution(player: OctavePlayer, event: MusicResolvedEvent): void {
  const snap = player.snapshot.get();
  const affected = snap.queue.items.filter((item) => matchesExternal(item.track, event.pluginId, event.externalId));
  if (affected.length === 0) return;
  const first = affected[0];
  if (!first) return;
  const resolved = resolvedTrackOf(first.track, event);
  const queue = replaceTrack(snap.queue, (t) => matchesExternal(t, event.pluginId, event.externalId), resolved);
  const now = currentItem(queue);
  const current = now && affected.some((a) => a.uid === now.uid) ? now.track : snap.current;
  player.snapshot.update({ queue, current });

  // Les entrées que le moteur tient déjà (courant, suivant) basculent leur source.
  const live = affected.filter((item) => player.engineKeys.has(item.uid) && (item.uid === now?.uid || item.uid === player.nextUid));
  if (live.length === 0) return;
  void player.deps.sources.get(resolved).then((source) => {
    if (!source) return;
    for (const item of live) {
      const engineKey = player.engineKeys.get(item.uid);
      if (engineKey) player.deps.engine.swapSource(engineKey, { ...source, trackKey: engineKey });
    }
    if (live.some((item) => item.uid === player.nextUid)) player.nextFromDevice = source.kept !== undefined;
    if (live.some((item) => item.uid === now?.uid)) player.snapshot.update({ origin: source.origin, fromDevice: source.kept !== undefined, format: source.format ?? resolved.format });
  });
}
