/**
 * Octave — REMPLIR une playlist de titres, DANS L'ORDRE (règle sans React ni réseau : un port les apporte).
 * Sert l'import d'un ALBUM (ses titres, disque par disque) et l'import de FICHIERS de l'appareil (les titres que
 * la chaîne des sorties vient de créer) : une playlist neuve au nom donné, ou une playlist existante (à la fin).
 *
 * Chaque titre prend la place qu'il aura dans la playlist (rang de départ + son rang) : un titre de la bibliothèque
 * entre par Jellyfin (les suites de titres de la bibliothèque, d'une requête), un titre hors bibliothèque (une
 * sortie importée) par l'extension (`playlistAdd`, « en attente » jusqu'à son arrivée dans Jellyfin). Les places
 * croissantes tiennent l'ordre pendant l'attente ET après l'arrivée (règle des gestes groupés).
 */

import type { ExternalActionOutcome, ExternalActionRefusal, MusicPlaylistDetail, MusicTrack } from "@tentacle-tv/shared/music";

export type FillItem = { kind: "library"; jellyfinId: string; track?: MusicTrack } | { kind: "external"; externalId: string };

export interface FillPort {
  create: (name: string, itemIds: string[]) => Promise<MusicPlaylistDetail>;
  insert: (playlistId: string, itemIds: string[], position: number, tracks: MusicTrack[]) => Promise<MusicPlaylistDetail>;
  /** Absent : l'extension n'ajoute pas de titre hors bibliothèque (aucun titre de ce genre n'est offert). */
  externalAdd?: (externalId: string, playlistId: string, position: number) => Promise<ExternalActionOutcome>;
}

/** Où vont les titres : une playlist NEUVE, ou une playlist existante (à la fin, après ses `entryCount` entrées). */
export type FillTarget = { kind: "new"; name: string } | { kind: "existing"; playlistId: string; name: string; entryCount: number };

export interface FillResult {
  playlistId: string;
  name: string;
  /** Titres entrés (y compris ceux qui attendent la bibliothèque). */
  added: number;
  /** Parmi eux, ceux qui attendent leur arrivée dans la bibliothèque. */
  pending: number;
  /** Titres que l'extension a refusés (l'ajout s'arrête au premier refus : quota, droits…). */
  refused: number;
  refusal: ExternalActionRefusal | null;
}

/** Un lot d'identifiants par requête Jellyfin (la création et l'ajout en acceptent 500 au plus). */
const BATCH = 500;

/** Les suites consécutives de titres de même nature : une requête par suite de titres de la bibliothèque. */
function runsOf(items: readonly FillItem[]): FillItem[][] {
  const runs: FillItem[][] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    if (last && last[0]?.kind === "library" && item.kind === "library" && last.length < BATCH) last.push(item);
    else runs.push([item]);
  }
  return runs;
}

const libraryIds = (run: readonly FillItem[]) => run.flatMap((i) => (i.kind === "library" ? [i.jellyfinId] : []));
const libraryTracks = (run: readonly FillItem[]) => run.flatMap((i) => (i.kind === "library" && i.track ? [i.track] : []));

export async function fillPlaylist(port: FillPort, target: FillTarget, items: readonly FillItem[]): Promise<FillResult> {
  const runs = runsOf(items);
  let playlistId: string;
  let name = target.name;
  let at: number;
  let added = 0;
  if (target.kind === "new") {
    // La première suite de la bibliothèque part avec la création : une requête de moins.
    const first = runs[0]?.[0]?.kind === "library" ? (runs.shift() ?? []) : [];
    const created = await port.create(target.name, libraryIds(first));
    playlistId = created.jellyfinId;
    name = created.name;
    at = first.length;
    added = first.length;
  } else {
    playlistId = target.playlistId;
    at = target.entryCount;
  }

  let pending = 0;
  for (const [r, run] of runs.entries()) {
    const head = run[0];
    if (!head) continue;
    if (head.kind === "library") {
      await port.insert(playlistId, libraryIds(run), at, libraryTracks(run));
      at += run.length;
      added += run.length;
      continue;
    }
    const outcome: ExternalActionOutcome = port.externalAdd ? await port.externalAdd(head.externalId, playlistId, at) : { ok: false, reason: "unavailable", message: null };
    if (!outcome.ok) {
      const left = runs.slice(r).reduce((sum, rest) => sum + rest.length, 0);
      return { playlistId, name, added, pending, refused: left, refusal: outcome.reason };
    }
    at += 1;
    added += 1;
    if (outcome.state === "pending") pending += 1;
  }
  return { playlistId, name, added, pending, refused: 0, refusal: null };
}

/** Les titres d'un album en éléments à ajouter : ceux de la bibliothèque, puis ceux qu'une extension ajoute. */
export function albumFillItems(tracks: readonly MusicTrack[], canAddExternal: (track: MusicTrack) => boolean): FillItem[] {
  const out: FillItem[] = [];
  for (const track of tracks) {
    if (track.availability === "library" && track.jellyfinId) out.push({ kind: "library", jellyfinId: track.jellyfinId, track });
    else if (track.external && canAddExternal(track)) out.push({ kind: "external", externalId: track.external.id });
  }
  return out;
}
