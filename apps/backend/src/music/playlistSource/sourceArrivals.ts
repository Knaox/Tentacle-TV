/**
 * Octave — une ARRIVÉE dans la bibliothèque se range d'elle-même dans les playlists importées qui l'attendaient, à son
 * RANG dans la source, jamais à la fin (Damien, 29/10 : un titre de sa playlist Spotify, absent à l'import, importé à
 * la main ensuite, restait hors de la playlist).
 *
 * Générique : quelle que soit sa provenance (import à la main, Lidarr, une extension, un dépôt dans le dossier), un
 * titre entre dans l'index par le flux des éléments audio (`events/audioItemsFeed.ts` : évènements des comptes, et
 * le passage complet du démarrage pour ce qui est arrivé serveur arrêté). Aucun relevé périodique : c'est l'arrivée
 * qui déclenche. Une rafale (un album entier) n'en fait qu'un passage.
 *
 * Pour chaque playlist importée dont un titre de la source est encore libre (`music_playlist_sources`) : les arrivées
 * que son compte VOIT, rapprochées par la règle du cœur (`arrivalPlan.ts`), entrent à leur rang par l'insertion qui
 * sert déjà l'extension (`insertFromHost` : verrou de la playlist, place lue dans la playlist telle qu'elle est,
 * liaison au relevé). Un élément déjà dans la playlist n'est jamais dupliqué ; une extension qui fait venir le même
 * titre (Sillon, `importPresence`) le trouve là et efface son entrée.
 */

import type { AudioItemsChange } from "../events/audioItemsFeed";
import { rowsByIds } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";
import { userView, visibleRows, type UserView } from "../view/viewContext";
import { arrivalBindings, hasFreeSlot } from "./arrivalPlan";
import type { PlaylistSourceRecord } from "./sourceRecord";
import { insertFromHost } from "./sourcePlacement";
import { listPlaylistSources } from "./sourceStore";

/** Une rafale d'arrivées (un album, un lot de Lidarr) ne fait qu'un passage. */
export const ARRIVAL_DEBOUNCE_MS = 2_000;
/** Au-delà de la fin : `insertFromHost` ne s'en sert que si rien ne relie l'élément à la source. */
const AT_END = Number.MAX_SAFE_INTEGER;

export interface SourceArrivalDeps {
  records: () => Promise<PlaylistSourceRecord[]>;
  rows: (ids: readonly string[]) => Promise<Map<string, IndexRow>>;
  view: (userId: string) => Promise<UserView>;
  insert: (userId: string, playlistId: string, itemId: string, rank: number) => Promise<boolean>;
  log: (line: string) => void;
}

const realDeps: SourceArrivalDeps = {
  records: listPlaylistSources,
  rows: rowsByIds,
  view: userView,
  insert: async (userId, playlistId, itemId, rank) => (await insertFromHost(userId, playlistId, [itemId], AT_END, rank)).ok,
  log: (line) => console.info(line),
};

/** Un passage : range ces arrivées dans chaque playlist importée qui les attend. Rend le nombre de titres rangés. */
export async function placeArrivals(itemIds: readonly string[], deps: SourceArrivalDeps = realDeps): Promise<number> {
  if (itemIds.length === 0) return 0;
  const waiting = (await deps.records()).filter((r) => hasFreeSlot(r.slots));
  if (waiting.length === 0) return 0;
  const arrived = [...(await deps.rows(itemIds)).values()].filter((r) => r.kind === "track");
  if (arrived.length === 0) return 0;
  const views = new Map<string, UserView>();
  let placed = 0;
  for (const record of waiting) {
    if (!views.has(record.userId)) views.set(record.userId, await deps.view(record.userId));
    const bindings = arrivalBindings(record.slots, visibleRows(views.get(record.userId)!, arrived));
    let here = 0;
    // Dans l'ordre de la source : chaque titre rangé sert de repère au suivant.
    for (const b of bindings) {
      if (!(await deps.insert(record.userId, record.playlistId, b.itemId, b.rank).catch(() => false))) break;
      here += 1;
    }
    if (here > 0) deps.log(`[music] ${here} arrivée(s) rangée(s) à leur rang dans la playlist importée ${record.playlistId}`);
    placed += here;
  }
  return placed;
}

/** L'abonné du flux des éléments audio : regroupe les arrivées, un passage à la fois. */
export function sourceArrivalWatcher(deps: SourceArrivalDeps = realDeps, debounceMs = ARRIVAL_DEBOUNCE_MS) {
  const pending = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> = Promise.resolve();
  const flush = () => {
    timer = null;
    const ids = [...pending];
    pending.clear();
    running = running.then(() => placeArrivals(ids, deps).then(
      () => undefined,
      (error: unknown) => deps.log(`[music] arrivées non rangées dans les playlists importées : ${(error as Error).message}`),
    ));
  };
  return {
    onChange(change: AudioItemsChange): void {
      for (const ref of change.added) pending.add(ref.jellyfinId);
      if (pending.size === 0 || timer) return;
      timer = setTimeout(flush, debounceMs);
      timer.unref?.();
    },
    /** Tests : attendre le passage en cours. */
    settled: () => running,
  };
}
