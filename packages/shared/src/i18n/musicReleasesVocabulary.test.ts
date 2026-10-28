import { describe, expect, it } from "vitest";
import fr from "./locales/fr/musicReleases";
import en from "./locales/en/musicReleases";
import frIndex from "./locales/fr";
import enIndex from "./locales/en";

/** Les clés d'un arbre de traductions, à plat. */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

function valueAt(table: object, key: string): string {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], table) as string;
}

const variablesOf = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] ?? "").sort();

describe("espace musicReleases (importer une sortie hors catalogue)", () => {
  it("les deux langues portent les mêmes clés et les mêmes variables, et sont enregistrées", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
    for (const key of keysOf(en)) expect(variablesOf(valueAt(en, key))).toEqual(variablesOf(valueAt(fr, key)));
    expect(frIndex.musicReleases).toBe(fr);
    expect(enIndex.musicReleases).toBe(en);
  });

  it("jamais « téléchargement » ni « download », aucune extension nommée", () => {
    const all = [...keysOf(fr).map((k) => valueAt(fr, k)), ...keysOf(en).map((k) => valueAt(en, k))].join("\n");
    expect(all).not.toMatch(/t[ée]l[ée]charg|download/i);
    expect(all).not.toMatch(/lidarr|yt-dlp|musicbrainz|sillon/i);
  });
});
