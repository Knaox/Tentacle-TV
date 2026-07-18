/**
 * Code saison/épisode partagé (web/desktop, réutilisable mobile/TV) — le motif
 * `S${…}E${…}` était dupliqué dans une dizaine de composants avec des formats
 * divergents (S02E05, S2E5 · Titre…).
 *
 * - "dot"    → « S2 · E5 » : compact, lisible — format des boutons Reprendre.
 * - "padded" → « S02E05 »  : technique — listes denses, libellés historiques.
 */
export type EpisodeCodeStyle = "dot" | "padded";

export function formatEpisodeCode(
  season: number | null | undefined,
  episode: number | null | undefined,
  opts?: { style?: EpisodeCodeStyle },
): string {
  const style = opts?.style ?? "dot";
  if (style === "padded") {
    return `S${String(season ?? 0).padStart(2, "0")}E${String(episode ?? 0).padStart(2, "0")}`;
  }
  return `S${season ?? "?"} · E${episode ?? "?"}`;
}
