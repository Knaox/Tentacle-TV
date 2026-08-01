/**
 * `safeJoin` est la seule chose qui empêche une traversée de dossier à partir
 * d'un chemin construit avec des identifiants venus d'un serveur, et
 * `hasCapacity` la seule qui empêche de remplir un disque jusqu'à le bloquer.
 * Les deux ont leur `#[test]` côté Rust ; les voici.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import {
  CAPACITY_MARGIN_BYTES,
  defaultRoot,
  ensureLayout,
  forgetRoot,
  freeSpace,
  hasCapacity,
  removeItemMediaDir,
  removeMediaFile,
  resolveRoot,
  safeJoin,
  setRoot,
} from "./paths";

const dossiers: string[] = [];

function dossierTemporaire(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tentacle-root-"));
  dossiers.push(dir);
  return dir;
}

afterEach(() => {
  forgetRoot();
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

describe("safeJoin", () => {
  const root = path.resolve("/tmp/root");

  it("accepte les deux prefixes attendus", () => {
    expect(safeJoin(root, "media/abc/file.mkv")).toBe(path.join(root, "media", "abc", "file.mkv"));
    expect(safeJoin(root, "meta/abc/primary.jpg")).toBe(path.join(root, "meta", "abc", "primary.jpg"));
  });

  it("refuse toute traversee", () => {
    for (const mauvais of [
      "../evil",
      "media/../../evil",
      "media/../evil",
      "/etc/passwd",
      "autre/x",
      "media/%2e%2e/x",
      "",
      "media/./x",
      "media//x",
      "..\\..\\evil",
      "media\\..\\..\\evil",
      "C:/Windows/System32",
      "media/x:stream",
    ]) {
      expect(() => safeJoin(root, mauvais), mauvais).toThrow("invalid-path");
    }
  });

  it("le prefixe seul est un chemin valide", () => {
    // `media` designe le dossier lui-meme : c'est ce que fait `removeItemDir`.
    expect(safeJoin(root, "media")).toBe(path.join(root, "media"));
  });
});

describe("marge disque", () => {
  const GIO = 1024 * 1024 * 1024;

  it("respecte la marge", () => {
    expect(hasCapacity(GIO, 4 * GIO)).toBe(true);
    // 1 Gio demande + 2 de marge = 3 : il en faut STRICTEMENT plus.
    expect(hasCapacity(GIO, 3 * GIO)).toBe(false);
    expect(hasCapacity(10 * GIO, 5 * GIO)).toBe(false);
  });

  it("ne deborde pas sur des valeurs demesurees", () => {
    expect(hasCapacity(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("la marge vaut bien 2 Gio", () => {
    expect(CAPACITY_MARGIN_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });

  it("l'espace libre est lisible sur un vrai volume", () => {
    // `statfsSync` remplace `fs4::available_space` : verifie qu'il repond, et
    // qu'il repond quelque chose de credible.
    const libre = freeSpace(dossierTemporaire());
    expect(libre).toBeGreaterThan(0);
    expect(Number.isFinite(libre)).toBe(true);
  });
});

describe("racine de stockage", () => {
  it("par defaut, sous le dossier de donnees", () => {
    const db = openInMemory();
    const userData = dossierTemporaire();

    const root = resolveRoot(db, userData);

    expect(root).toBe(defaultRoot(userData));
    expect(existsSync(path.join(root, "media"))).toBe(true);
    expect(existsSync(path.join(root, "meta"))).toBe(true);
  });

  it("un changement de racine est refuse tant qu'il reste des telechargements", () => {
    const db = openInMemory();
    db.prepare(
      `INSERT INTO files (item_id, media_source_id, variant, rel_path, created_at, updated_at)
       VALUES ('i1', 'ms1', 'original', 'media/i1/original-ms1.mkv', 1, 1)`,
    ).run();

    expect(() => setRoot(db, dossierTemporaire())).toThrow("root-not-empty");
  });

  it("un refus d'ecriture porte le code EN PREFIXE, suivi de la cause systeme", () => {
    const db = openInMemory();
    // Une racine SOUS un fichier : `mkdir` ne peut pas aboutir, quel que soit
    // le systeme. C'est le seul moyen portable de provoquer l'echec sans
    // dependre d'ACL, et le message qui en sort est celui que l'utilisateur
    // lira dans un paquet livre.
    const fichier = path.join(dossierTemporaire(), "pas-un-dossier");
    writeFileSync(fichier, "x");

    let capture: Error | null = null;
    try {
      setRoot(db, path.join(fichier, "films"));
    } catch (error) {
      capture = error as Error;
    }

    expect(capture).not.toBeNull();
    // Le PREFIXE est le contrat lu par `apps/web/src/downloads/api.ts`.
    expect(capture?.message.startsWith("root-not-writable")).toBe(true);
    // Et la cause ne doit PAS avoir ete avalee : sans elle, un refus dans un
    // paquet livre reste inexplicable — le journal du processus principal n'y
    // va nulle part.
    expect(capture?.message.length).toBeGreaterThan("root-not-writable".length);
  });

  it("un changement accepte est memorise et relu", () => {
    const db = openInMemory();
    const ailleurs = path.join(dossierTemporaire(), "films");

    expect(setRoot(db, ailleurs)).toBe(ailleurs);
    expect(existsSync(path.join(ailleurs, "media"))).toBe(true);

    forgetRoot();
    expect(resolveRoot(db, dossierTemporaire())).toBe(ailleurs);
  });
});

describe("suppressions", () => {
  function racinePreparee(): string {
    const root = dossierTemporaire();
    ensureLayout(root);
    return root;
  }

  it("efface le fichier ET son .part", () => {
    const root = racinePreparee();
    const rel = "media/i1/original-ms1.mkv";
    mkdirSync(path.join(root, "media", "i1"), { recursive: true });
    writeFileSync(path.join(root, rel), "video");
    writeFileSync(path.join(root, `${rel}.part`), "partiel");

    removeMediaFile(root, rel);

    expect(readdirSync(path.join(root, "media", "i1"))).toEqual([]);
  });

  it("un fichier deja absent n'est pas une erreur", () => {
    const root = racinePreparee();
    expect(() => removeMediaFile(root, "media/i1/absent.mkv")).not.toThrow();
  });

  it("le dossier media emporte les side-cars de sous-titres", () => {
    const root = racinePreparee();
    mkdirSync(path.join(root, "media", "i1", "subs"), { recursive: true });
    writeFileSync(path.join(root, "media", "i1", "subs", "3-fre.srt"), "1");

    removeItemMediaDir(root, "i1");

    expect(existsSync(path.join(root, "media", "i1"))).toBe(false);
  });
});
