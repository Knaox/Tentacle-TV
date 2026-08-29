/**
 * Le nom de fichier est construit à partir d'un identifiant venu du serveur :
 * `safeStem` est la seule chose qui empêche une traversée de dossier. Et
 * `Buffer.from` ne se plaint jamais d'un base64 abîmé — c'est le contrôle
 * explicite qui évite d'écrire un JPEG tronqué, donc une photo de profil
 * cassée pour toutes les sessions suivantes.
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { avatarPath, get, put, safeStem } from "./avatar";

const folders: string[] = [];

function tempFolder(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tentacle-avatar-"));
  folders.push(dir);
  return dir;
}

afterEach(() => {
  while (folders.length > 0) {
    const dir = folders.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Un JPEG minimal : en-tête SOI + marqueur de fin. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString("base64");

describe("nom de fichier", () => {
  it("ne garde que l'alphanumerique", () => {
    expect(safeStem("c2e997cc19afc07f")).toBe("c2e997cc19afc07f");
    expect(safeStem("a-b-c")).toBe("abc");
  });

  it("neutralise toute traversee", () => {
    // Le point et la barre disparaissent : impossible de sortir du dossier.
    expect(safeStem("../../etc/passwd")).toBe("etcpasswd");
    expect(safeStem("..\\..\\win")).toBe("win");
  });

  it("refuse un identifiant sans alphanumerique", () => {
    // Rendre un nom vide ferait collisionner tous ces cas entre eux.
    expect(() => safeStem("../..")).toThrow();
    expect(() => safeStem("")).toThrow();
  });

  it("le chemin reste sous le dossier des avatars", () => {
    const dir = tempFolder();
    expect(path.dirname(avatarPath(dir, "../../evil"))).toBe(dir);
  });
});

describe("cache de la photo", () => {
  it("aller-retour", () => {
    const dir = tempFolder();
    put(dir, "u-1", JPEG);
    expect(get(dir, "u-1")).toBe(JPEG);
  });

  it("aucune photo n'est pas une erreur", () => {
    expect(get(tempFolder(), "u-1")).toBeNull();
  });

  it("refuse un base64 abime plutot que d'ecrire un JPEG tronque", () => {
    const dir = tempFolder();
    for (const bad of ["!!!!", "abc", "AAAA AAAA"]) {
      expect(() => put(dir, "u-1", bad), bad).toThrow();
    }
    expect(existsSync(path.join(dir, "u1.jpg"))).toBe(false);
  });

  it("refuse le vide et le demesure", () => {
    const dir = tempFolder();
    expect(() => put(dir, "u-1", "")).toThrow(/hors bornes/);
    // 600 Kio decodes, au-dela du plafond de 512.
    expect(() => put(dir, "u-1", Buffer.alloc(600 * 1024).toString("base64"))).toThrow(/hors bornes/);
  });

  it("ne laisse pas de fichier temporaire derriere lui", () => {
    const dir = tempFolder();
    put(dir, "u-1", JPEG);
    expect(readdirSync(dir)).toEqual(["u1.jpg"]);
  });

  it("les utilisateurs ont chacun leur fichier", () => {
    const dir = tempFolder();
    put(dir, "u-1", JPEG);
    expect(get(dir, "u-2")).toBeNull();
  });
});
