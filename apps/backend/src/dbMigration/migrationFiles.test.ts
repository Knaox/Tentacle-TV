import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { backupPath, createPrivateFile, moveDatabase, refuseSymlinks, removeDraft, requiredBytes } from "./migrationFiles";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tentacle-migfiles-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const mode = (path: string) => statSync(path).mode & 0o777;

describe("fichiers de la migration (audits S4 et SC2)", () => {
  it("le brouillon naît en 0600, et un fichier d'avant plus ouvert y est ramené", () => {
    const fresh = join(dir, "tentacle.db.migrating");
    createPrivateFile(fresh);
    expect(mode(fresh)).toBe(0o600);
    const loose = join(dir, "autre");
    writeFileSync(loose, "", { mode: 0o644 });
    createPrivateFile(loose);
    expect(mode(loose)).toBe(0o600);
  });

  it("une base déplacée en .bak garde 0600, son WAL avec elle", () => {
    const db = join(dir, "tentacle.db");
    writeFileSync(db, "x", { mode: 0o644 });
    writeFileSync(`${db}-wal`, "y", { mode: 0o644 });
    const bak = backupPath(db, new Date(Date.UTC(2026, 9, 8, 15, 4, 5)));
    expect(bak).toBe(`${db}.20261008-150405.bak`);
    moveDatabase(db, bak);
    expect(existsSync(db)).toBe(false);
    expect(mode(bak)).toBe(0o600);
    expect(mode(`${bak}-wal`)).toBe(0o600);
  });

  it("deux .bak à la même seconde ne s'écrasent pas", () => {
    const db = join(dir, "tentacle.db");
    const at = new Date(Date.UTC(2026, 9, 8, 15, 4, 5));
    writeFileSync(backupPath(db, at), "");
    expect(backupPath(db, at)).toBe(`${db}.20261008-150405-2.bak`);
  });

  it("un lien symbolique à la place de la base, du brouillon ou de son WAL est REFUSÉ, sans le suivre", () => {
    const outside = join(dir, "ailleurs");
    writeFileSync(outside, "ne pas toucher");
    const db = join(dir, "tentacle.db");
    symlinkSync(outside, `${db}.migrating-wal`);
    expect(() => refuseSymlinks(`${db}.migrating`)).toThrow(/lien symbolique/);
    expect(() => removeDraft(`${db}.migrating`)).toThrow(/lien symbolique/);
    symlinkSync(outside, `${db}.x`);
    expect(() => createPrivateFile(`${db}.x`)).toThrow(/lien symbolique/);
    expect(mode(outside)).not.toBe(0o600);
  });

  it("place exigée : la taille de la source + 10 % + 100 Mo", () => {
    expect(requiredBytes(849e6)).toBe(Math.ceil(849e6 * 1.1) + 100 * 1024 * 1024);
  });
});
