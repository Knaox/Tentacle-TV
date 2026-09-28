import type { WtAffinityKind, WtRoomStateDto } from "@tentacle-tv/shared";

/** Affinité — ce qui se dit pareil partout : le nom d'un type, une liste de noms. */

export const KIND_LABEL_KEY: Record<WtAffinityKind, string> = {
  movie: "affinityKindMovie",
  series: "affinityKindSeries",
  anime: "affinityKindAnime",
};

export const AFFINITY_KINDS: readonly WtAffinityKind[] = ["movie", "series", "anime"];

/** « Alice, Bob et Chloé », dans la langue de l'interface. */
export function formatNames(names: readonly string[], language: string): string {
  if (names.length <= 1) return names[0] ?? "";
  try {
    return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** Le nom d'un membre de la salle (vide s'il en est parti). */
export function memberName(room: WtRoomStateDto | null, userId: string | null): string {
  if (!room || !userId) return "";
  return room.members.find((m) => m.userId === userId)?.username ?? "";
}
