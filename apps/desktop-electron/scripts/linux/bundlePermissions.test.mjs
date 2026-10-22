import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openBundlePermissions } from "./bundlePermissions.mjs";

const mode = (p) => statSync(p).mode & 0o7777;
let root;
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("openBundlePermissions", () => {
  it("ouvre le dossier né de mkdtemp (0700), comme celui de @electron/packager", () => {
    root = mkdtempSync(path.join(tmpdir(), "bundle-"));
    expect(mode(root)).toBe(0o700);
    expect(openBundlePermissions(root)).toEqual(["."]);
    expect(mode(root)).toBe(0o755);
  });

  it("ajoute la lecture sans retirer les bits d'exécution ni le SUID", () => {
    root = mkdtempSync(path.join(tmpdir(), "bundle-"));
    const exe = path.join(root, "tentacle-tv");
    const sandbox = path.join(root, "chrome-sandbox");
    const data = path.join(root, "sub", "resources.pak");
    mkdirSync(path.dirname(data));
    chmodSync(path.dirname(data), 0o700);
    writeFileSync(exe, ""); chmodSync(exe, 0o700);
    writeFileSync(sandbox, ""); chmodSync(sandbox, 0o4755);
    writeFileSync(data, ""); chmodSync(data, 0o600);

    openBundlePermissions(root);

    expect(mode(exe)).toBe(0o755);
    expect(mode(sandbox)).toBe(0o4755);
    expect(mode(path.dirname(data))).toBe(0o755);
    expect(mode(data)).toBe(0o644);
  });

  it("ne touche à rien de déjà lisible", () => {
    root = mkdtempSync(path.join(tmpdir(), "bundle-"));
    chmodSync(root, 0o755);
    writeFileSync(path.join(root, "f"), "");
    chmodSync(path.join(root, "f"), 0o644);
    expect(openBundlePermissions(root)).toEqual([]);
  });
});
