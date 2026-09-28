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

/** « Votre coup de cœur », « Coup de cœur de Bob », « Coup de cœur de Bob et
 *  vous » — jamais « Coup de cœur de Vous ». */
export function superlikeLabel(input: {
  ids: readonly string[];
  selfId: string | null;
  nameOf: (userId: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  language: string;
}): string {
  const mine = !!input.selfId && input.ids.includes(input.selfId);
  const others = input.ids.filter((id) => id !== input.selfId).map(input.nameOf);
  if (mine && others.length === 0) return input.t("affinitySuperlikeMine");
  const names = mine ? [...others, input.t("affinityYouLower")] : others;
  return input.t("affinitySuperlikeBy", { names: formatNames(names, input.language) });
}
