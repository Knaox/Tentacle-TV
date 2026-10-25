import { beforeEach, describe, expect, it } from "vitest";
import {
  ROW_ENTRANCE_MEMORY_MAX, hasRowEntered, markRowEntered, resetRowEntranceMemoryForTests, rowEntranceId,
} from "./rowEntranceMemory";

beforeEach(() => resetRowEntranceMemoryForTests());

describe("rowEntranceMemory — une entrée par contenu", () => {
  it("l'identité : le titre et les titres de tête, rien d'autre", () => {
    const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
    expect(rowEntranceId("Tendances", keys)).toBe(rowEntranceId("Tendances", [...keys.slice(0, 12), "autre"]));
    expect(rowEntranceId("Tendances", keys)).not.toBe(rowEntranceId("Pour vous", keys));
    expect(rowEntranceId("Tendances", keys)).not.toBe(rowEntranceId("Tendances", ["nouveau", ...keys]));
  });

  it("jouée une fois, retenue ; sans identité, jamais retenue", () => {
    const id = rowEntranceId("Derniers ajouts", ["a", "b"]);
    expect(hasRowEntered(id)).toBe(false);
    markRowEntered(id);
    expect(hasRowEntered(id)).toBe(true);
    markRowEntered(undefined);
    expect(hasRowEntered(undefined)).toBe(false);
  });

  it("bornée : la plus ancienne sort", () => {
    markRowEntered("premiere");
    for (let i = 0; i < ROW_ENTRANCE_MEMORY_MAX; i += 1) markRowEntered(`r${i}`);
    expect(hasRowEntered("premiere")).toBe(false);
    expect(hasRowEntered(`r${ROW_ENTRANCE_MEMORY_MAX - 1}`)).toBe(true);
  });
});
