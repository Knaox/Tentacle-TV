import { describe, expect, it, vi } from "vitest";
import { holdBackDuringMigration } from "./migrationBack";

describe("Retour pendant l'écran de migration de la base (LG)", () => {
  it("rend la main au téléviseur, et l'appui ne va pas plus loin", () => {
    let consumer: (() => boolean) | null = null;
    const release = vi.fn();
    const yieldToTv = vi.fn();
    const unregister = holdBackDuringMigration((c) => { consumer = c; return release; }, yieldToTv);
    expect(consumer!()).toBe(true);
    expect(yieldToTv).toHaveBeenCalledTimes(1);
    unregister();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
