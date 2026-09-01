import { buildLibraryIndex } from "./libraryIndex";
import type { LibraryIndex } from "./libraryIndex";

// L'index de bibliothèque est un balayage complet de Jellyfin : mémoïsé dix
// minutes et PARTAGÉ entre le service des rangées et la génération du pool —
// avant ce module, chacun refaisait son propre balayage de zéro.
const memo = new Map<string, { at: number; index: LibraryIndex }>();
const LIBRARY_MEMO_MS = 10 * 60_000;

export async function getLibraryIndexMemo(userId: string): Promise<LibraryIndex> {
  const hit = memo.get(userId);
  if (hit && Date.now() - hit.at < LIBRARY_MEMO_MS) return hit.index;
  const index = await buildLibraryIndex(userId);
  memo.set(userId, { at: Date.now(), index });
  return index;
}

/** Sur UserDataChanged (vu/favori posé) : le prochain lecteur revoit l'état frais. */
export function invalidateLibraryMemo(userId: string): void {
  memo.delete(userId);
}
