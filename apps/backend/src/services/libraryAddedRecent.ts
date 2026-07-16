import type { LibItem } from "./jellyfin";
import { normalizeTitle } from "./libraryAddedDedup";

// Anti-doublon « saison éclatée » : Jellyfin indexe les épisodes d'une saison de
// façon échelonnée → le notifier les découvre sur plusieurs polls et enverrait
// une notif par lot (« Saison 1 (3 épisodes) » puis « (5 épisodes) »). On
// mémorise (en RAM, TTL court) le contenu déjà annoncé pour n'émettre qu'UNE
// notif par (film) ou (série+saison) sur la fenêtre. Intra-ajout par nature :
// un cache mémoire suffit (l'état survivant, knownIds, est déjà persistant).

const TTL_MS = 6 * 60 * 60_000; // 6 h : couvre l'arrivée échelonnée d'un même ajout
const announced = new Map<string, number>(); // contentKey → expiresAt (ms epoch)

/**
 * Clé de contenu au niveau (film) ou (série + saison) — PAS série seule, pour ne
 * pas masquer une autre saison légitimement ajoutée dans la fenêtre.
 */
function contentKey(it: LibItem): string {
  if (it.Type === "Movie") return `m:${it.tmdbId ?? it.Id}`;
  const series = it.seriesTmdbId ?? normalizeTitle(it.SeriesName ?? it.Name);
  if (it.Type === "Episode") return `s:${series}:${it.ParentIndexNumber ?? "?"}`;
  if (it.Type === "Season") return `s:${series}:${it.IndexNumber ?? "?"}`;
  return `s:${series}:all`; // Series (ajout de la série entière)
}

/** Purge les entrées expirées (borne la RAM). */
function purge(now: number): void {
  for (const [k, exp] of announced) if (exp <= now) announced.delete(k);
}

/**
 * Retire les items dont le contenu a déjà été annoncé récemment ; enregistre les
 * survivants comme annoncés « maintenant ». Filtrage GLOBAL (un contenu = une
 * notif, tous utilisateurs confondus). Les items d'une même (série+saison) dans
 * le MÊME lot sont tous conservés (ils forment ensemble une seule notif).
 */
export function filterRecentlyAnnounced(items: LibItem[]): LibItem[] {
  const now = Date.now();
  purge(now);
  const fresh: LibItem[] = [];
  const keysThisBatch = new Set<string>();
  for (const it of items) {
    const key = contentKey(it);
    if (announced.has(key)) continue; // déjà notifié sur la fenêtre → skip
    fresh.push(it);
    keysThisBatch.add(key);
  }
  for (const key of keysThisBatch) announced.set(key, now + TTL_MS);
  return fresh;
}
