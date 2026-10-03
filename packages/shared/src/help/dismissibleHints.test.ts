import { describe, expect, it } from "vitest";
import {
  LEGACY_KNOWN_HINTS,
  isHintMark,
  normalizeDismissedHints,
  normalizeHintMarks,
  normalizeKnownHints,
  storedHintEntries,
} from "./dismissibleHints";

/**
 * Le contrat des rappels masqués : les noms seuls ou marqués se lisent de la
 * même façon, une marque abîmée s'ignore, et ce qui s'écrit reste lisible par
 * un serveur d'avant les marques (les noms seuls restent des chaînes).
 */
describe("rappels masqués du compte", () => {
  it("lit les noms, seuls ou marqués, dans l'ordre du contrat et sans doublon", () => {
    expect(normalizeDismissedHints([{ hint: "serverUpdate", mark: "1.23.0" }, "trailerHelp", "trailerHelp"]))
      .toEqual(["trailerHelp", "serverUpdate"]);
    expect(normalizeDismissedHints(["inconnu", { hint: "inconnu" }, 3, null])).toEqual([]);
    expect(normalizeDismissedHints("trailerHelp")).toEqual([]);
  });

  it("lit les marques d'une ligne en base comme d'une réponse, et ignore les marques abîmées", () => {
    expect(normalizeHintMarks([{ hint: "serverUpdate", mark: "1.23.0" }, "trailerHelp"])).toEqual({ serverUpdate: "1.23.0" });
    expect(normalizeHintMarks({ serverUpdate: "1.24.0", inconnu: "1.0.0" })).toEqual({ serverUpdate: "1.24.0" });
    expect(normalizeHintMarks([{ hint: "serverUpdate", mark: "1 2" }, { hint: "tmdbKey", mark: 12 }])).toEqual({});
    expect(normalizeHintMarks(undefined)).toEqual({});
  });

  it("une marque est une version courte, sans espace", () => {
    expect(isHintMark("1.23.0")).toBe(true);
    expect(isHintMark("1.23.0-beta+2")).toBe(true);
    expect(isHintMark("")).toBe(false);
    expect(isHintMark("x".repeat(33))).toBe(false);
    expect(isHintMark("<b>")).toBe(false);
  });

  it("un serveur qui n'annonce pas sa liste ne sait retenir que le contrat d'origine", () => {
    expect(normalizeKnownHints(undefined)).toEqual([...LEGACY_KNOWN_HINTS]);
    expect(normalizeKnownHints(["tmdbKey", "inconnu", "serverUpdate"])).toEqual(["serverUpdate", "tmdbKey"]);
  });

  it("écrit les noms seuls en chaînes, et les marqués en objets", () => {
    expect(storedHintEntries(["serverUpdate", "trailerHelp"], { serverUpdate: "1.23.0", trailerHelp: "" }))
      .toEqual(["trailerHelp", { hint: "serverUpdate", mark: "1.23.0" }]);
    // Ce qui s'écrit se relit à l'identique.
    const stored = storedHintEntries(["serverUpdate"], { serverUpdate: "1.23.0" });
    expect(normalizeDismissedHints(stored)).toEqual(["serverUpdate"]);
    expect(normalizeHintMarks(stored)).toEqual({ serverUpdate: "1.23.0" });
  });
});
