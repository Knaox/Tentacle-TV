import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareDataFolder } from "./dataFolder";
import { dataLayout } from "./dataLayout";

const systemRoot = process.env.SystemRoot ?? "C:\\Windows";

// Vrai `icacls`, vrai `whoami` : ne tourne que sous Windows.
describe.runIf(process.platform === "win32")("prepareDataFolder (Windows)", () => {
  let base = "";
  afterEach(() => {
    if (base) rmSync(base, { recursive: true, force: true });
  });

  it("crée le dossier, ses sous-dossiers, et ne laisse que trois ayants droit sans héritage", async () => {
    base = mkdtempSync(join(tmpdir(), "host-acl-"));
    const layout = dataLayout(base);
    expect(await prepareDataFolder(layout, systemRoot)).toEqual({ ok: true, created: true });
    expect(existsSync(layout.logs) && existsSync(layout.cache)).toBe(true);

    const acl = execFileSync(join(systemRoot, "System32", "icacls.exe"), [layout.root], { encoding: "utf8" });
    // Une entrée héritée porterait « (I) » ; les Utilisateurs (S-1-5-32-545) n'y sont plus.
    expect(acl).not.toContain("(I)");
    const grants = acl.split(/\r?\n/).filter((line) => line.includes(":("));
    expect(grants).toHaveLength(3);
  });

  it("ne retouche pas un dossier existant", async () => {
    base = mkdtempSync(join(tmpdir(), "host-acl-"));
    const layout = dataLayout(base);
    await prepareDataFolder(layout, systemRoot);
    expect(await prepareDataFolder(layout, systemRoot)).toEqual({ ok: true, created: false });
  });
});
