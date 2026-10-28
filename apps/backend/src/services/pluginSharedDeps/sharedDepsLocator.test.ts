import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSharedDepsLocator, sharedDepsDirs } from "./sharedDepsLocator";

// Un dossier neuf par test, par `mkdtempSync` : jamais un nom deviné d'avance (pid).
let ROOT = "";
beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "tentacle-shared-deps-locator-"));
});
afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

describe("localisateur des dépendances partagées", () => {
  it("sans TENTACLE_DATA_DIR, les deux dossiers se confondent : un seul à lire", () => {
    expect(sharedDepsDirs("/app/data", "/app/data/shared-deps")).toEqual(["/app/data/shared-deps"]);
    expect(sharedDepsDirs("/banc/data", "/app/data/shared-deps")).toEqual(["/banc/data/shared-deps", "/app/data/shared-deps"]);
  });

  it("deux pages ouvertes ensemble : UN build, les deux servies", async () => {
    const dir = join(ROOT, "build");
    let runs = 0;
    let release!: () => void;
    const locate = createSharedDepsLocator({
      dirs: [join(ROOT, "data", "shared-deps"), dir],
      mayBuild: () => true,
      build: () => new Promise<void>((done) => {
        runs++;
        release = () => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, "shared-deps.js"), "/* construit */");
          writeFileSync(join(dir, "tailwind.js"), "/* tailwind */");
          done();
        };
      }),
    });
    const both = Promise.all([locate("shared-deps.js"), locate("tailwind.js")]);
    await Promise.resolve();
    release();
    expect(await both).toEqual([join(dir, "shared-deps.js"), join(dir, "tailwind.js")]);
    expect(runs).toBe(1);
  });

  it("en production (pas de build permis) : null, sans rien lancer", async () => {
    let runs = 0;
    const locate = createSharedDepsLocator({
      dirs: [join(ROOT, "rien")],
      mayBuild: () => false,
      build: async () => { runs++; },
    });
    expect(await locate("shared-deps.js")).toBeNull();
    expect(runs).toBe(0);
  });
});
