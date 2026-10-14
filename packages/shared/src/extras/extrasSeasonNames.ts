import type { TrailerScope } from "../trailers";
import type { ExtraEntry } from "./extraEntries";

/**
 * Dans un carrousel qui réunit plusieurs saisons (la fiche d'une série,
 * celle d'un épisode dont la saison n'a rien), chaque tuile dit sa saison
 * en tête de sa ligne : « Saison 2 · Coulisses », « Saison 6 · VF · AlloCiné ».
 * Web, bureau, miroir et mobile.
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

/** Le nom d'une portée du catalogue : « Saison 6 » ; rien pour la série ou le film (`t` : i18next ou équivalent). */
export function scopeName(t: (key: string, options: { season: number }) => string, scope: TrailerScope): string | null {
  return scope.kind === "season" ? t("common:trailerScopeSeason", { season: scope.season }) : null;
}
