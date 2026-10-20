import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));
const { closeWtSheet, currentWtSheet, openWtSheet } = await import("./wtSheets");

describe("wtSheets", () => {
  afterEach(() => closeWtSheet());

  it("une feuille à la fois : en ouvrir une remplace l'autre", () => {
    openWtSheet("room");
    expect(currentWtSheet()).toBe("room");
    openWtSheet("invite");
    expect(currentWtSheet()).toBe("invite");
    closeWtSheet();
    expect(currentWtSheet()).toBeNull();
  });
});
