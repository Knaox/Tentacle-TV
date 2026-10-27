/**
 * Octave — une playlist gardée est la playlist EN LIGNE, en version hors ligne
 * (Damien, 28/10 : « littéralement une copie »), règle PURE
 * (`keptPlaylistRows.test.ts`).
 *
 * L'ordre naturel est celui de la playlist telle qu'Octave la montre en ligne
 * (`mergePlaylist` : les entrées Jellyfin, et les attentes d'un import à leur
 * rang dans la source, puis `libraryFirst`). Quand on le connaît — en ligne, ou
 * relu du cache d'Octave sans réseau —, ses rangées font foi : leur ordre, leurs
 * doublons, leur identité (entrée Jellyfin, attente), donc les dates du tri
 * « Date d'ajout ». Chaque rangée y prend la COPIE gardée de son titre (pochette
 * locale, lecture depuis le disque) ; une rangée sans copie n'est pas là.
 *
 * Un titre gardé que ces rangées ne connaissent pas (cache plus vieux que la
 * copie, attentes illisibles sans réseau) se pose juste après celui qui le
 * précède dans la collection gardée (`trackKeys`, que la tenue à jour aligne sur
 * la playlist en ligne), en tête s'il n'en a pas. Sans rangées en ligne : l'ordre
 * de la collection gardée, tel quel.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";

export interface KeptEntry {
  /** La clé du titre dans la collection gardée (celle d'aujourd'hui). */
  key: string;
  /** Sa copie, telle que l'appareil la lit. */
  track: MusicTrack;
}

const plainRow = (entry: KeptEntry): ListRow => ({ rowKey: entry.key, track: entry.track, pending: null, entryId: null });

export function keptPlaylistRows(kept: readonly KeptEntry[], online: readonly ListRow[] | null): ListRow[] {
  if (!online || online.length === 0) return kept.map(plainRow);
  // Une copie se reconnaît à la clé de la collection ou à celle du fichier (un titre renommé depuis).
  const byKey = new Map<string, KeptEntry>();
  for (const entry of kept) {
    byKey.set(entry.key, entry);
    if (!byKey.has(entry.track.key)) byKey.set(entry.track.key, entry);
  }
  const used = new Set<KeptEntry>();
  const rows: ListRow[] = [];
  // La première rangée de chaque copie : les titres inconnus se posent après elle.
  const firstAt = new Map<number, KeptEntry>();
  for (const row of online) {
    const entry = byKey.get(row.track.key);
    if (!entry) continue;
    if (!used.has(entry)) firstAt.set(rows.length, entry);
    used.add(entry);
    rows.push({ ...row, track: entry.track });
  }
  // Les titres gardés que la playlist en ligne ne connaît pas : après leur prédécesseur dans la collection.
  let previous: KeptEntry | null = null;
  const after = new Map<KeptEntry | null, KeptEntry[]>();
  for (const entry of kept) {
    if (used.has(entry)) {
      previous = entry;
      continue;
    }
    const list = after.get(previous);
    if (list) list.push(entry);
    else after.set(previous, [entry]);
  }
  if (after.size === 0) return rows;
  const out: ListRow[] = (after.get(null) ?? []).map(plainRow);
  rows.forEach((row, index) => {
    out.push(row);
    const owner = firstAt.get(index);
    if (owner) out.push(...(after.get(owner) ?? []).map(plainRow));
  });
  return out;
}
