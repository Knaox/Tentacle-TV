/**
 * Octave — Jellyfin RELIT les titres qu'il a rangés sans album (règle :
 * `orphanRereadPlan.ts`). Pour chacun : l'élément, tags relus et remplacés
 * (`FullRefresh` + `ReplaceAllMetadata`, les champs verrouillés à la main
 * restent), puis son dossier, récursivement (`refreshContaining`) — les
 * fichiers du même album que Jellyfin n'avait pas vus entrent avec lui.
 * Jamais un redémarrage de Jellyfin, jamais toute la bibliothèque.
 *
 * Déclenché par l'index lui-même : après le passage complet du démarrage, et
 * quand un évènement y fait entrer un titre sans album — `ORPHAN_REREAD_DELAY_MS`
 * après le dernier, pour laisser Lidarr écrire ses tags. Le retour passe par
 * les évènements ordinaires (`LibraryChanged`) : l'index suit.
 */

import { getPrisma } from "../../services/db";
import { getConfigValue, setConfigValue } from "../../services/configStore";
import { adminUserParam } from "../../services/jellyfinLibrary";
import { isLibraryPath, refreshContaining } from "../host/folderRefresh";
import { jfAdmin, jfWrite, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { getMusicLibrary } from "../jellyfin/musicLibrary";
import { folderOf, nextAttempts, ORPHAN_REREAD_DELAY_MS, ORPHAN_REREAD_PER_PASS, parseAttempts, pickOrphans } from "./orphanRereadPlan";

export const ORPHAN_REREAD_KEY = "music_orphan_reread";
const ITEM_REREAD = "Recursive=false&MetadataRefreshMode=FullRefresh&ImageRefreshMode=Default&ReplaceAllMetadata=true&ReplaceAllImages=false";

let timer: NodeJS.Timeout | null = null;
let running: Promise<RereadReport | null> | null = null;

export interface RereadReport {
  orphans: number;
  items: number;
  folders: number;
  /** D'autres attendent leur tour : un passage suivra. */
  more: boolean;
}

async function orphanIds(): Promise<string[]> {
  const rows = await getPrisma().$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_items" WHERE "kind" = 'track' AND "albumId" IS NULL ORDER BY "dateCreated" DESC, "id"`,
  );
  return rows.map((r) => r.id);
}

async function pathsOf(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const result = await jfAdmin<JfItemsPage>(`/Items?Ids=${ids.map(q).join(",")}&Fields=Path&EnableImages=false&EnableUserData=false${await adminUserParam()}`);
  if (!result.ok) return new Map();
  return new Map((result.data.Items ?? []).flatMap((i) => (i.Path ? [[normalizeId(i.Id), i.Path] as const] : [])));
}

/** Un passage : relit ce qui doit l'être. `null` sans bibliothèque musique. */
export async function rereadOrphans(now: () => number = Date.now): Promise<RereadReport | null> {
  const library = await getMusicLibrary();
  if (!library) return null;
  const orphans = await orphanIds();
  const attempts = parseAttempts(getConfigValue(ORPHAN_REREAD_KEY));
  const due = pickOrphans(orphans, attempts, now(), ORPHAN_REREAD_PER_PASS + 1);
  const picked = due.slice(0, ORPHAN_REREAD_PER_PASS);
  const paths = await pathsOf(picked);
  let items = 0;
  for (const id of picked) if ((await jfWrite(`/Items/${q(id)}/Refresh?${ITEM_REREAD}`, "POST")).ok) items += 1;
  const folders = [...new Set([...paths.values()].map(folderOf).filter((f): f is string => f !== null && isLibraryPath(library, f)))];
  for (const folder of folders) await refreshContaining(library, folder, now);
  if (picked.length > 0 || Object.keys(attempts).length > 0) {
    await setConfigValue(ORPHAN_REREAD_KEY, JSON.stringify(nextAttempts(attempts, orphans, picked, now()))).catch(() => undefined);
  }
  if (picked.length > 0) console.log(`[music] relecture demandée à Jellyfin : ${items}/${picked.length} titres sans album (${orphans.length} dans l'index), ${folders.length} dossiers`);
  return { orphans: orphans.length, items, folders: folders.length, more: due.length > picked.length };
}

/** Un passage, un seul à la fois. */
export function runOrphanReread(): Promise<RereadReport | null> {
  running ??= rereadOrphans()
    .catch((error: unknown) => {
      console.warn("[music] relecture des titres sans album interrompue :", (error as Error).message);
      return null;
    })
    .finally(() => {
      running = null;
    });
  // Un arriéré (le premier passage d'une bibliothèque) se relit par vagues, au même rythme.
  void running.then((report) => {
    if (report?.more) scheduleOrphanReread();
  });
  return running;
}

/** Un passage `ORPHAN_REREAD_DELAY_MS` après le DERNIER appel (une rafale d'arrivées n'en fait qu'un). */
export function scheduleOrphanReread(delayMs = ORPHAN_REREAD_DELAY_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runOrphanReread();
  }, delayMs);
  timer.unref?.();
}

export function resetOrphanRereadForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  running = null;
}
