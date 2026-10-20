import { describe, expect, it } from "vitest";
import frMobile from "../i18n/locales/fr/familyMobile";
import enMobile from "../i18n/locales/en/familyMobile";
import { FIRST_RUN_FINISH_KEY, FIRST_RUN_PROGRESS_KEY, FIRST_RUN_SKIP_KEY, FIRST_RUN_STEP_IDS, FIRST_RUN_STEPS, firstRunPrimaryKey } from "./firstRunCatalog";

function lookup(tree: unknown, key: string): unknown {
  const [, path] = key.split(":");
  return path.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe("le catalogue du premier lancement", () => {
  it("l'ordre de la TV : code, accueil, photo — une entrée par étape", () => {
    expect(FIRST_RUN_STEPS.map((step) => step.id)).toEqual([...FIRST_RUN_STEP_IDS]);
    expect(FIRST_RUN_STEP_IDS).toEqual(["pinSetup", "homeRows", "photoSetup"]);
  });

  it("chaque clé existe en français et en anglais", () => {
    const keys = [FIRST_RUN_SKIP_KEY, FIRST_RUN_FINISH_KEY, FIRST_RUN_PROGRESS_KEY, ...FIRST_RUN_STEPS.flatMap((s) => [s.titleKey, s.bodyKey, s.primaryKey])];
    for (const key of keys) {
      expect(typeof lookup(frMobile, key), key).toBe("string");
      expect(typeof lookup(enMobile, key), key).toBe("string");
    }
  });

  it("l'accueil ne se passe pas (« Continuer » suffit) et termine en dernière étape", () => {
    expect(FIRST_RUN_STEPS.find((s) => s.id === "homeRows")?.skippable).toBe(false);
    expect(firstRunPrimaryKey("homeRows", true)).toBe(FIRST_RUN_FINISH_KEY);
    expect(firstRunPrimaryKey("homeRows", false)).toBe("familyMobile:firstRun.next");
    expect(firstRunPrimaryKey("pinSetup", true)).toBe("familyMobile:firstRun.pinSet");
  });
});
