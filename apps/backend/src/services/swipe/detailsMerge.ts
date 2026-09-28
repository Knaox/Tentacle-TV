import type { CardDetails } from "./cardDetails";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/**
 * Un synopsis affichable : les fiches Jellyfin venues d'AniDB ou d'AniList
 * portent du HTML (« <br>Source: … », liens) — les sauts de ligne restent,
 * les balises partent, les entités courantes se décodent.
 */
export function cleanOverview(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, e: string) => ENTITIES[e] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/**
 * Le verso d'une carte à partir des deux sources : TMDB d'abord (dans la
 * langue de l'utilisateur), Jellyfin en repli — la bibliothèque est souvent
 * décrite dans une autre langue que l'interface. Un titre de bibliothèque
 * garde SON titre (celui de la carte, de la fiche, de la recherche) : le
 * titre TMDB ne remplace que celui d'un titre hors bibliothèque.
 */
export function mergeDetails(remote: CardDetails | null, local: CardDetails | null, inLibrary: boolean): CardDetails {
  return {
    title: inLibrary ? null : remote?.title ?? null,
    overview: cleanOverview(remote?.overview) ?? cleanOverview(local?.overview),
    runtimeMinutes: remote?.runtimeMinutes ?? local?.runtimeMinutes ?? null,
    seasons: remote?.seasons ?? local?.seasons ?? null,
  };
}
