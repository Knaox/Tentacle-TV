import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { download, install, type OwnershipProbe } from "./update";

/**
 * La page ne décide pas de ce qui s'installe.
 *
 * URL, empreinte et chemin arrivent de la page par IPC : un rendu compromis
 * (XSS, greffon qui s'échappe) ne doit pouvoir ni faire télécharger un binaire
 * d'ailleurs que des Releases du dépôt, ni sauter la vérification d'empreinte,
 * ni faire installer un fichier que le processus principal n'a pas lui-même
 * téléchargé et vérifié.
 */

const RELEASE = "https://github.com/Knaox/Tentacle-TV/releases/download/desktop-v9.9.9/tentacle-tv_9.9.9_amd64.deb";
const BODY = new TextEncoder().encode("paquet");
// SHA-256 de « paquet ».
const BODY_SHA = "df4ef319fd92bd9a6b1c599c8aaf970db62502fcc03576a780734cea8af69b23";

const fetchSpy = vi.fn(async () => new Response(BODY, { status: 200 }));

beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  delete process.env["APPIMAGE"];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["APPIMAGE"];
});

const noProgress = (): void => undefined;

describe("download — URL et empreinte venues de la page", () => {
  it("refuse une URL hors des Releases du dépôt, sans rien télécharger", async () => {
    for (const url of [
      "https://evil.example/tentacle.deb",
      "http://github.com/Knaox/Tentacle-TV/releases/download/v/x.deb",
      "https://github.com/Autre/Tentacle-TV/releases/download/v/x.deb",
      "https://github.com/Knaox/Tentacle-TV/archive/x.deb",
      "https://user:pw@github.com/Knaox/Tentacle-TV/releases/download/v/x.deb",
      "https://github.com:8443/Knaox/Tentacle-TV/releases/download/v/x.deb",
      "file:///etc/passwd",
    ]) {
      await expect(download({ url, sha256: BODY_SHA, fileName: "x.deb", onProgress: noProgress })).rejects.toThrow();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuse une empreinte absente ou mal formée, sans rien télécharger", async () => {
    for (const sha256 of ["", "abc", "z".repeat(64), `${BODY_SHA}00`]) {
      await expect(download({ url: RELEASE, sha256, fileName: "x.deb", onProgress: noProgress })).rejects.toThrow();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepte une Release du dépôt dont l'empreinte correspond", async () => {
    const local = await download({ url: RELEASE, sha256: BODY_SHA.toUpperCase(), fileName: "ok.deb", onProgress: noProgress });
    expect(existsSync(local)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("download — dossier de dépôt", () => {
  it("dépose dans un dossier PRIVÉ et propre à chaque téléchargement", async () => {
    // `/tmp` est partagé : un dossier au nom fixe pouvait être créé d'avance
    // par un autre compte, qui aurait alors échangé le paquet entre la
    // vérification et l'invite pkexec.
    const a = await download({ url: RELEASE, sha256: BODY_SHA, fileName: "a.deb", onProgress: noProgress });
    const b = await download({ url: RELEASE, sha256: BODY_SHA, fileName: "a.deb", onProgress: noProgress });
    expect(path.dirname(a)).not.toBe(path.dirname(b));
    expect(statSync(path.dirname(a)).mode & 0o077).toBe(0);
  });
});

describe("install — seulement ce que le principal a vérifié", () => {
  const ownedByDpkg: OwnershipProbe = async (command) => command === "dpkg";

  it("refuse un fichier qu'il n'a pas téléchargé lui-même", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tentacle-trust-"));
    const planted = path.join(dir, "planted.deb");
    writeFileSync(planted, "x");
    await expect(install(planted, "deb", ownedByDpkg)).rejects.toThrow(/non vérifié/);
  });

  it("refuse un format qui n'est pas celui de l'installation", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tentacle-trust-"));
    const target = path.join(dir, "Tentacle.AppImage");
    writeFileSync(target, "ancienne");
    process.env["APPIMAGE"] = "";
    // La page dit « appimage » sur une installation deb : rien ne doit être remplacé.
    await expect(install(target, "appimage", ownedByDpkg)).rejects.toThrow();
    expect(existsSync(target)).toBe(true);
  });
});
