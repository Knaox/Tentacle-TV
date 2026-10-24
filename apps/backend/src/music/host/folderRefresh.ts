/**
 * Octave — `jellyfin.refreshPath` : faire VOIR tout de suite à Jellyfin ce qui
 * vient d'arriver dans un dossier de sa bibliothèque musique, sans attendre
 * `LibraryMonitorDelay` (60 s par défaut) comme `/Library/Media/Updated`.
 * Mesuré par A7 sur le banc : 0,12 s contre 60 s (la phase « en attente »
 * après un cœur passe de ~69 s à ~1 s).
 *
 * Le dossier connu le plus proche qui contient le chemin — l'album, sinon
 * l'artiste — se rafraîchit RÉCURSIVEMENT. Aucun dossier connu (artiste
 * neuf) : la bibliothèque sans récursion (le nouveau dossier y apparaît),
 * puis ce dossier-là, récursivement. On descend par les enfants directs
 * (`ParentId`), chemin compris : jamais un parcours de toute la bibliothèque.
 */

import { adminUserParam } from "../../services/jellyfinLibrary";
import { jfAdmin, jfWrite, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import type { MusicLibrary } from "../jellyfin/musicLibrary";

const MAX_DEPTH = 4;
/** Le dossier d'un artiste neuf apparaît vite après le rafraîchissement de la bibliothèque : on l'attend 10 s au plus. */
const APPEAR_TIMEOUT_MS = 10_000;
const APPEAR_STEP_MS = 250;

const REFRESH = "Recursive=true&MetadataRefreshMode=Default&ImageRefreshMode=Default&ReplaceAllMetadata=false&ReplaceAllImages=false";
const SHALLOW = "Recursive=false&MetadataRefreshMode=Default&ImageRefreshMode=Default&ReplaceAllMetadata=false&ReplaceAllImages=false";

/** Sans séparateur final ; « / » et « \\ » acceptés (Jellyfin sous Windows). */
export function trimPath(path: string): string {
  return path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
}

/** `child` est `parent`, ou se trouve dessous. Pur. */
export function insidePath(child: string, parent: string): boolean {
  const c = trimPath(child);
  const p = trimPath(parent);
  return c === p || c.startsWith(`${p}/`) || c.startsWith(`${p}\\`);
}

/** Un chemin absolu, sans « .. », sous un dossier de la bibliothèque musique. Pur. */
export function isLibraryPath(library: MusicLibrary, path: string): boolean {
  if (path.length === 0 || path.length > 1024 || /(^|[\\/])\.\.([\\/]|$)/.test(path) || path.includes("\0")) return false;
  if (!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path)) return false;
  return library.paths.some((root) => insidePath(path, root));
}

interface Folder {
  id: string;
  path: string;
}

async function childFolders(parentId: string): Promise<Folder[] | null> {
  const result = await jfAdmin<JfItemsPage>(
    `/Items?ParentId=${q(parentId)}&Fields=Path&EnableImages=false&EnableUserData=false${await adminUserParam()}`,
  );
  if (!result.ok) return null;
  return (result.data.Items ?? [])
    .filter((item) => item.IsFolder !== false && typeof item.Path === "string")
    .map((item) => ({ id: normalizeId(item.Id), path: item.Path! }));
}

/** Le dossier connu le plus profond qui contient `path`, depuis la bibliothèque ; `null` : aucun. */
export async function deepestKnownFolder(libraryId: string, path: string): Promise<Folder | null | undefined> {
  let found: Folder | null = null;
  let parent = libraryId;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const children = await childFolders(parent);
    // Jellyfin muet : on ne sait pas (`undefined`), ce n'est pas « aucun dossier ».
    if (children === null) return depth === 0 ? undefined : found;
    const next = children.find((child) => insidePath(path, child.path));
    if (!next) break;
    found = next;
    parent = next.id;
    if (trimPath(next.path) === trimPath(path)) break;
  }
  return found;
}

async function refresh(itemId: string, query: string): Promise<boolean> {
  return (await jfWrite(`/Items/${q(itemId)}/Refresh?${query}`, "POST")).ok;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type FolderRefreshResult = { ok: true; scope: "folder" | "library"; itemId: string } | { ok: false };

export async function refreshContaining(library: MusicLibrary, path: string, now: () => number = Date.now): Promise<FolderRefreshResult> {
  const known = await deepestKnownFolder(library.libraryId, path);
  if (known === undefined) return { ok: false };
  if (known) return (await refresh(known.id, REFRESH)) ? { ok: true, scope: "folder", itemId: known.id } : { ok: false };
  // Artiste neuf : la bibliothèque sans récursion fait apparaître son dossier, qu'on rafraîchit ensuite.
  if (!(await refresh(library.libraryId, SHALLOW))) return { ok: false };
  const deadline = now() + APPEAR_TIMEOUT_MS;
  while (now() < deadline) {
    await sleep(APPEAR_STEP_MS);
    const appeared = await deepestKnownFolder(library.libraryId, path);
    if (appeared) {
      await refresh(appeared.id, REFRESH);
      return { ok: true, scope: "library", itemId: appeared.id };
    }
  }
  // Pas encore là : la bibliothèque est rafraîchie, Jellyfin le trouvera à son passage.
  return { ok: true, scope: "library", itemId: library.libraryId };
}
