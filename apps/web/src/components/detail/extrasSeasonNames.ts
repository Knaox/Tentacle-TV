import type { TFunction } from "i18next";
import type { ExtraEntry, TrailerScope } from "@tentacle-tv/shared";

/**
 * Dans un carrousel qui réunit plusieurs saisons (la fiche d'une série,
 * celle d'un épisode dont la saison n'a rien), chaque tuile dit sa saison
 * en tête de sa ligne : « Saison 2 · Coulisses », « Saison 6 · VF · AlloCiné ».
 */
export function withSeasonNames(
  entries: ExtraEntry[],
  ownerOf: ReadonlyMap<string, string>,
  seasonNames: ReadonlyMap<string, string> | null,
): ExtraEntry[] {
  if (!seasonNames) return entries;
  return entries.map((entry) => {
    if (entry.source !== "local") return entry;
    const owner = ownerOf.get(entry.itemId);
    const name = owner ? seasonNames.get(owner) : undefined;
    if (!name) return entry;
    return { ...entry, subtitle: entry.subtitle ? `${name} · ${entry.subtitle}` : name };
  });
}

/** Le nom d'une portée du catalogue : « Saison 6 » ; rien pour la série ou le film. */
export function scopeName(t: TFunction, scope: TrailerScope): string | null {
  return scope.kind === "season" ? t("common:trailerScopeSeason", { season: scope.season }) : null;
}
