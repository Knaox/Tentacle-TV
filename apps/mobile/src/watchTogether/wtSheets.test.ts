import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));
const { closeWtSheet, currentWtSheet, openWtSheet, peekWtLink, requestWtLink, takeWtLink } = await import("./wtSheets");

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

  it("un lien profond se note et ne se prend qu'une fois", () => {
    requestWtLink("affinity");
    expect(peekWtLink()).toBe("affinity");
    expect(takeWtLink()).toBe("affinity");
    expect(takeWtLink()).toBeNull();
  });
});
