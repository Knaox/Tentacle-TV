/**
 * Octave — la FILE face à la bibliothèque : un titre d'ailleurs déjà mis en file (suite d'un clic, radio, playlist
 * d'ailleurs) que la bibliothèque a devient le sien, à sa place — la bascule de `music:resolved`
 * (`applyResolution` : entrées requalifiées, source du titre courant et du suivant changée à chaud). La demande
 * porte sur une fenêtre de la file, recalée tous les `WINDOW_STEP` titres (pas une requête par titre écouté), et
 * se relit quand la bibliothèque change (un import arrivé bascule sans geste).
 */

import { useEffect, useMemo } from "react";
import { useMusicLibraryMatch } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { applyResolution } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

const WINDOW = 200;
const WINDOW_STEP = 50;

/** Les titres d'ailleurs de la file, une fois chacun, à partir de la fenêtre du curseur. Pur. */
export function queueOutsiders(tracks: readonly MusicTrack[], cursor: number): MusicTrack[] {
  const start = Math.max(0, Math.floor(Math.max(cursor, 0) / WINDOW_STEP) * WINDOW_STEP);
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  for (const track of tracks.slice(start)) {
    if (out.length >= WINDOW) break;
    if (track.jellyfinId !== null || !track.external || seen.has(track.key)) continue;
    seen.add(track.key);
    out.push(track);
  }
  return out;
}

export function useQueueLibraryTwins(): void {
  const player = useOctavePlayer();
  const items = usePlayerSelector((s) => s.queue.items);
  const cursor = usePlayerSelector((s) => s.queue.cursor);
  const outsiders = useMemo(() => queueOutsiders(items.map((i) => i.track), cursor), [items, cursor]);
  const matches = useMusicLibraryMatch(outsiders);
  useEffect(() => {
    for (const track of outsiders) {
      const own = matches.tracks.get(track.key);
      if (!own?.jellyfinId || !track.external) continue;
      applyResolution(player, { type: "music:resolved", pluginId: track.external.pluginId, externalId: track.external.id, jellyfinId: own.jellyfinId, recording: own.mbids.recording, track: own });
    }
  }, [matches.tracks, outsiders, player]);
}
