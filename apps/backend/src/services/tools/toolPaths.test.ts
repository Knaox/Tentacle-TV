/**
 * Les outils externes : les défauts de l'image Docker tant que rien n'est posé,
 * et un zipapp toujours lancé par l'interpréteur (Windows n'exécute pas un shebang).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { pinnedYtDlpPath, pythonCommand, tarCommand, ytDlpInvocation } from "./toolPaths";

let folder: string | null = null;

afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
});

function fixture(name: string, content: Buffer): string {
  folder ??= mkdtempSync(join(tmpdir(), "tentacle-tools-"));
  const file = join(folder, name);
  writeFileSync(file, content);
  return file;
}

describe("toolPaths", () => {
  it("sans réglage : python3 et /usr/local/bin/yt-dlp, comme l'image", () => {
    expect(pythonCommand({})).toBe("python3");
    expect(pinnedYtDlpPath({})).toBe("/usr/local/bin/yt-dlp");
  });

  it("l'app Windows pose les siens", () => {
    const env = { TENTACLE_PYTHON: "C:\\Program Files\\WindowsApps\\Tentacle\\python\\python.exe", TENTACLE_YTDLP_PINNED: "C:\\Tentacle\\tools\\yt-dlp" };
    expect(pythonCommand(env)).toBe(env.TENTACLE_PYTHON);
    expect(pinnedYtDlpPath(env)).toBe(env.TENTACLE_YTDLP_PINNED);
    expect(pythonCommand({ TENTACLE_PYTHON: "  " })).toBe("python3");
  });

  it("un zipapp passe par l'interpréteur ; un autre yt-dlp se lance tel quel", () => {
    const zipapp = fixture("yt-dlp", Buffer.concat([Buffer.from("#!/usr/bin/env python3\n"), Buffer.from("PK\x03\x04rest", "latin1")]));
    const script = fixture("yt-dlp-brew", Buffer.from("#!/bin/sh\nexec python3 -m yt_dlp \"$@\"\n"));
    const env = { TENTACLE_PYTHON: "C:\\py\\python.exe" };
    expect(ytDlpInvocation(zipapp, env)).toEqual({ file: "C:\\py\\python.exe", args: [zipapp] });
    expect(ytDlpInvocation(script, env)).toEqual({ file: script, args: [] });
    expect(ytDlpInvocation("yt-dlp", env)).toEqual({ file: "yt-dlp", args: [] });
    expect(readFileSync(zipapp).subarray(0, 2).toString()).toBe("#!");
  });

  it("tar : celui du système par son chemin sous Windows, celui du PATH ailleurs", () => {
    expect(tarCommand({}, "linux")).toBe("tar");
    expect(tarCommand({}, "darwin")).toBe("tar");
    // Une racine système qui n'a pas de tar : le PATH, plutôt qu'un chemin qui n'existe pas.
    expect(tarCommand({ SystemRoot: join(tmpdir(), "pas-de-windows") }, "win32")).toBe("tar");
    if (process.platform === "win32") {
      expect(tarCommand(process.env, "win32").toLowerCase()).toMatch(/\\system32\\tar\.exe$/);
    }
  });
});
