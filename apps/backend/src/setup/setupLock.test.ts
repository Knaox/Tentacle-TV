import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, describe, expect, it, vi } from "vitest";

const complete = vi.hoisted(() => ({ value: false }));
vi.mock("../services/configStore", () => ({ isSetupComplete: () => complete.value }));

import { isSetupClosed, sealSetup, unsealSetup } from "./setupLock";

const dir = mkdtempSync(join(tmpdir(), "wiz-lock-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("installation fermée", () => {
  const lock = join(dir, "setup-complete");

  it("ouverte tant qu'aucune des deux preuves n'existe", () => {
    complete.value = false;
    expect(isSetupClosed(lock)).toBe(false);
  });

  it("le drapeau de la base suffit (installation d'avant)", () => {
    complete.value = true;
    expect(isSetupClosed(lock)).toBe(true);
  });

  it("le fichier suffit — base en panne au démarrage comprise", () => {
    complete.value = false;
    sealSetup(lock, new Date("2026-10-05T12:00:00Z"));
    expect(isSetupClosed(lock)).toBe(true);
    // Posé une fois : sa date ne bouge plus.
    sealSetup(lock, new Date("2030-01-01T00:00:00Z"));
    expect(readFileSync(lock, "utf-8")).toBe("2026-10-05T12:00:00.000Z\n");
  });

  it("seule la commande de la machine le retire", () => {
    unsealSetup(lock);
    expect(isSetupClosed(lock)).toBe(false);
    expect(() => unsealSetup(lock)).not.toThrow();
  });
});
