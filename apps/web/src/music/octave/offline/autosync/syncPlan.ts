/**
 * Octave — la TENUE À JOUR de la musique gardée (réglage d'appareil « Tenir à
 * jour les playlists gardées », éteint par défaut), règle PURE
 * (`syncPlan.test.ts`). Elle reçoit ce que l'appareil garde, ce que le serveur
 * dit maintenant, et rend les gestes à faire — jamais un effet.
 *
 * 1. Une playlist gardée a gagné un titre : il est gardé ; elle en a perdu un :
 *    il quitte l'appareil, sauf si quelque chose d'autre le RETIENT (un album
 *    gardé, une autre playlist, ou un titre gardé seul — collection `track`).
 * 2. Un titre gardé depuis l'extension a maintenant sa version Jellyfin (« Jellyfin
 *    fait foi ») : la version Jellyfin est gardée, puis — SEULEMENT une fois
 *    complète — l'ancienne copie part et les collections passent à la nouvelle
 *    clé. Jamais un titre sans fichier entre les deux.
 * 3. La forme voulue par le serveur pour un titre de la bibliothèque a changé (le
 *    mode Allégé de l'administration) : la nouvelle forme est gardée, l'ancienne
 *    part une fois la nouvelle complète.
 * Ce qui n'a pas été relu (hors ligne, refus) ne change pas : tout se rattrape au
 * passage suivant, sans rien dupliquer (un titre déjà en file n'est pas redemandé).
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { keptToTrack } from "../deviceModel";

export interface WantedForm {
  variant: "original" | "light";
  preset: string | null;
}

export interface SyncInputs {
  kept: readonly KeptMusicTrack[];
  collections: readonly KeptMusicCollection[];
  /** Le contenu ACTUEL des playlists gardées, par clé de collection ; absente : non relue → intacte. */
  playlists: ReadonlyMap<string, readonly MusicTrack[]>;
  /** Le titre de la bibliothèque qui EST un titre d'ailleurs, par clé `ext:`. */
  twins: ReadonlyMap<string, MusicTrack>;
  /** La forme voulue par le serveur pour un titre de la bibliothèque, par clé `jf:`. */
  wanted: ReadonlyMap<string, WantedForm>;
  /** Ce titre peut-il être gardé par ce compte (`keepRules.ts`) ? */
  canKeep: (track: MusicTrack) => boolean;
}

export interface SyncActions {
  keep: MusicTrack[];
  removeFileIds: number[];
  saveCollections: KeptMusicCollection[];
  removeCollections: string[];
}

export const holdKey = (trackKey: string): string => `track:${trackKey}`;

const noLocal = (): null => null;

function byKey(kept: readonly KeptMusicTrack[]): Map<string, KeptMusicTrack[]> {
  const out = new Map<string, KeptMusicTrack[]>();
  for (const k of kept) {
    if (k.status === "canceled") continue;
    out.set(k.trackKey, [...(out.get(k.trackKey) ?? []), k]);
  }
  return out;
}

const unique = (keys: readonly string[]): string[] => [...new Set(keys)];
const sameKeys = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((k, i) => k === b[i]);

/** Ce qui retient encore ce titre, hors la collection `except` (la playlist qui vient de le perdre, celle qu'on retire). */
export function isHeld(trackKey: string, collections: Iterable<KeptMusicCollection>, except: string | null = null): boolean {
  for (const c of collections) {
    if (c.key !== except && c.trackKeys.includes(trackKey)) return true;
  }
  return false;
}

export function planSync(input: SyncInputs): SyncActions {
  const files = byKey(input.kept);
  const working = new Map(input.collections.map((c) => [c.key, { ...c, trackKeys: [...c.trackKeys] }]));
  const changed = new Set<string>();
  const removeCollections = new Set<string>();
  const keep = new Map<string, MusicTrack>();
  const removeFiles = new Set<number>();
  const canonical = (key: string): string => input.twins.get(key)?.key ?? key;
  const wantKeep = (track: MusicTrack): void => {
    if (!files.has(track.key) && input.canKeep(track)) keep.set(track.key, track);
  };
  const candidates = new Map<string, string>();

  // 1. Les playlists relues : leurs titres d'aujourd'hui, à leur clé de bibliothèque si elle existe.
  for (const c of working.values()) {
    const now = c.kind === "playlist" ? input.playlists.get(c.key) : undefined;
    if (!now) continue;
    const next = unique(now.map((t) => canonical(t.key)));
    for (const t of now) wantKeep(input.twins.get(t.key) ?? t);
    for (const old of c.trackKeys) if (!next.includes(canonical(old))) candidates.set(old, c.key);
    if (!sameKeys(next, c.trackKeys)) {
      c.trackKeys = next;
      changed.add(c.key);
    }
  }

  // 2. Les copies d'ailleurs dont la version Jellyfin existe : gardée d'abord, l'ancienne part une fois la nouvelle complète.
  for (const [key, kept] of files) {
    const twin = input.twins.get(key);
    if (!twin || kept[0]?.origin !== "external") continue;
    const ready = (files.get(twin.key) ?? []).some((f) => f.status === "complete");
    if (!ready) {
      wantKeep(twin);
      continue;
    }
    for (const f of kept) removeFiles.add(f.fileId);
    for (const c of working.values()) {
      if (!c.trackKeys.includes(key)) continue;
      c.trackKeys = unique(c.trackKeys.map((k) => (k === key ? twin.key : k)));
      changed.add(c.key);
    }
    const hold = working.get(holdKey(key));
    if (hold) {
      removeCollections.add(hold.key);
      working.delete(hold.key);
      changed.delete(hold.key);
      const moved = { ...hold, key: holdKey(twin.key), trackKeys: [twin.key] };
      working.set(moved.key, moved);
      changed.add(moved.key);
    }
  }

  // 3. La forme voulue par le serveur a changé : la nouvelle d'abord, l'ancienne ensuite.
  for (const [key, form] of input.wanted) {
    const kept = files.get(key);
    if (!kept) continue;
    const match = kept.find((f) => f.variant === form.variant && (f.preset ?? null) === form.preset);
    if (!match) {
      const track = keptToTrack(kept[0]!, noLocal);
      if (input.canKeep(track)) keep.set(key, track);
      continue;
    }
    if (match.status === "complete") for (const f of kept) if (f.fileId !== match.fileId) removeFiles.add(f.fileId);
  }

  // 4. Les titres que leur playlist a perdus, et que plus rien ne retient : ils quittent l'appareil.
  for (const [key] of candidates) {
    if (isHeld(key, working.values())) continue;
    for (const f of files.get(key) ?? []) removeFiles.add(f.fileId);
    keep.delete(key);
  }

  return {
    keep: [...keep.values()],
    removeFileIds: [...removeFiles],
    saveCollections: [...changed].map((k) => working.get(k)).filter((c): c is KeptMusicCollection => !!c),
    removeCollections: [...removeCollections],
  };
}
