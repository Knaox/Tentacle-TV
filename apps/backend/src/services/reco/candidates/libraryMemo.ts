import { buildLibraryIndex } from "./libraryIndex";
import type { LibraryEntry, LibraryIndex } from "./libraryIndex";

/**
 * L'index de bibliothèque est un balayage complet de Jellyfin (jusqu'à 40
 * pages de 1000 titres) : mémoïsé dix minutes et PARTAGÉ entre le service
 * des rangées et la génération du pool.
 *
 * Remplacement, jamais d'invalidation : un index vieux se sert tel quel
 * pendant que le suivant se construit en fond — le jeter (UserDataChanged
 * arrivait pendant et après chaque lecture) faisait tomber le balayage
 * complet DANS le handler HTTP du lecteur suivant. Un scan en échec laisse
 * l'ancien index en place.
 */
const LIBRARY_MEMO_MS = 10 * 60_000;
/** Une salve de UserDataChanged ne coûte qu'un balayage. */
const REFRESH_DEBOUNCE_MS = 10_000;
/** Un index que personne n'a lu depuis un jour sort de la mémoire. */
const SWEEP_AFTER_MS = 24 * 3600_000;

interface MemoEntry {
  at: number;
  lastReadAt: number;
  index: LibraryIndex;
}

const memo = new Map<string, MemoEntry>();
const refreshing = new Map<string, Promise<LibraryIndex>>();
const refreshTimers = new Map<string, NodeJS.Timeout>();

async function refreshNow(userId: string): Promise<LibraryIndex> {
  const pending = refreshing.get(userId);
  if (pending) return pending;
  const p = buildLibraryIndex(userId)
    .then((index) => {
      const now = Date.now();
      memo.set(userId, { at: now, lastReadAt: memo.get(userId)?.lastReadAt ?? now, index });
      return index;
    })
    .catch((err: unknown) => {
      const hit = memo.get(userId);
      if (!hit) throw err;
      console.error(`[Reco] Index bibliothèque ${userId.slice(0, 8)}… : l'ancien reste servi —`, err);
      return hit.index;
    })
    .finally(() => refreshing.delete(userId));
  refreshing.set(userId, p);
  return p;
}

/** L'index du compte : servi tout de suite s'il existe (rafraîchi en fond
 *  au-delà de dix minutes), construit si le compte n'en a pas encore. */
export async function getLibraryIndexMemo(userId: string): Promise<LibraryIndex> {
  const hit = memo.get(userId);
  if (hit) {
    hit.lastReadAt = Date.now();
    if (Date.now() - hit.at >= LIBRARY_MEMO_MS) void refreshNow(userId).catch(() => undefined);
    return hit.index;
  }
  return refreshNow(userId);
}

/**
 * L'index du compte S'IL EST DÉJÀ en mémoire, sans jamais attendre un
 * balayage : le chemin chaud du service de page s'en sert pour exclure ce
 * que le compte vient de voir, de mettre en favori ou dans Ma liste. Absent :
 * null, et la construction part en fond pour la requête suivante.
 */
export function peekLibraryIndexMemo(userId: string): LibraryIndex | null {
  const hit = memo.get(userId);
  if (!hit) {
    void refreshNow(userId).catch(() => undefined);
    return null;
  }
  hit.lastReadAt = Date.now();
  if (Date.now() - hit.at >= LIBRARY_MEMO_MS) void refreshNow(userId).catch(() => undefined);
  return hit.index;
}

/** Sur UserDataChanged (vu/favori posé) : rafraîchissement EN FOND, débouncé
 *  — l'index courant continue d'être servi jusqu'au remplacement. */
export function refreshLibraryMemo(userId: string): void {
  if (!userId) return;
  const existing = refreshTimers.get(userId);
  if (existing) clearTimeout(existing);
  refreshTimers.set(
    userId,
    setTimeout(() => {
      refreshTimers.delete(userId);
      void refreshNow(userId).catch(() => undefined);
    }, REFRESH_DEBOUNCE_MS)
  );
}

/** Ce qu'un geste du compte change d'une entrée, sans attendre le balayage. */
export type LibraryEntryPatch = Partial<Pick<LibraryEntry, "isFavorite" | "inWatchlist" | "played">>;

/**
 * Retouche EN PLACE l'entrée d'un titre dans l'index en mémoire du compte —
 * par sa clé (« movie:603 ») ou son id Jellyfin — pour qu'un cœur, Ma liste
 * ou « vu » posé à l'instant sorte des recommandations dès la requête
 * suivante. Le prochain balayage (débouncé, en fond) remplace l'index de
 * toute façon. Rend l'entrée retouchée, ou null (pas d'index, titre absent).
 */
export function patchLibraryMemo(userId: string, keyOrItemId: string, patch: LibraryEntryPatch): LibraryEntry | null {
  const hit = memo.get(userId);
  if (!hit) return null;
  const entry =
    hit.index.byKey.get(keyOrItemId) ?? hit.index.entries.find((e) => e.itemId === keyOrItemId) ?? null;
  if (entry) Object.assign(entry, patch);
  return entry;
}

/** Au boot : les index des comptes actifs, l'un après l'autre. */
export async function prewarmLibraryMemo(userIds: readonly string[]): Promise<void> {
  for (const userId of userIds) {
    if (memo.has(userId)) continue;
    await refreshNow(userId).catch(() => undefined);
  }
}

/** Retire les index que personne n'a lus depuis un jour ; rend le nombre retiré. */
export function sweepLibraryMemo(now = Date.now()): number {
  let removed = 0;
  for (const [userId, entry] of memo) {
    if (now - entry.lastReadAt >= SWEEP_AFTER_MS && !refreshTimers.has(userId)) {
      memo.delete(userId);
      removed++;
    }
  }
  return removed;
}

/** Isolation des tests. */
export function resetLibraryMemoForTests(): void {
  memo.clear();
  refreshing.clear();
  for (const t of refreshTimers.values()) clearTimeout(t);
  refreshTimers.clear();
}
