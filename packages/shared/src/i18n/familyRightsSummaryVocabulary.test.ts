import { describe, expect, it } from "vitest";
import fr from "./locales/fr/familyRightsSummary";
import en from "./locales/en/familyRightsSummary";
import { familyRightsSummary } from "../family/familyRightsSummary";

/**
 * L'espace du résumé des droits : mêmes clés et variables dans les deux
 * langues, chaque clé que rend le modèle existe, et jamais « téléchargement »
 * (le mobile le lit, CLAUDE.md).
 */

type Tree = { [key: string]: string | Tree };
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("familyRightsSummary — vocabulaire", () => {
  const FR = flatten(fr as unknown as Tree);
  const EN = flatten(en as unknown as Tree);

  it("mêmes clés et mêmes variables", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
    for (const key of Object.keys(FR)) expect(placeholders(EN[key]), key).toEqual(placeholders(FR[key]));
  });

  it("jamais « téléchargement »", () => {
    for (const text of [...Object.values(FR), ...Object.values(EN)]) expect(text).not.toMatch(/t[ée]l[ée]charg|download/i);
  });

  it("chaque clé rendue par le modèle existe", () => {
    const guest = { userId: "g", kind: "guest" as const, name: "P", color: "teal" as const, hasPin: false, imageTag: null, since: null, createdBy: null, createdByName: null, rights: null };
    const member = { ...guest, kind: "member" as const, rights: { createGuests: true }, parent: true };
    const parental = { maxParentalRating: 6, maxParentalSubRating: null, blockUnratedItems: ["Movie" as const], blockedTags: ["x"], accessSchedules: [{ dayOfWeek: "Everyday" as const, startHour: 1, endHour: 2 }] };
    const libs = { available: [{ id: "a", name: "A", collectionType: null }, { id: "b", name: "B", collectionType: null }], allowed: ["a"] };
    const used = [
      familyRightsSummary({ profile: { ...guest, parental, guestRights: { requestTitles: false, suspended: true } }, libraries: libs }),
      familyRightsSummary({ profile: member }),
    ].flatMap((s) => s.lines.map((l) => l.key));
    for (const key of used) expect(FR[key], key).toBeTypeOf("string");
  });
});
