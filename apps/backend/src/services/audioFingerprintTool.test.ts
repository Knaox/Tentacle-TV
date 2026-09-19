/**
 * L'outil d'empreinte : la détection (fpcalc, repli ffmpeg, aucun), une seule
 * fois par processus ; les parseurs ; les arguments passés aux binaires.
 * `child_process` est bouchonné — aucun binaire ne tourne ici.
 */

import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("child_process", () => ({ execFile: mocks.execFile }));

import {
  POINTS_PER_SECOND,
  detectFingerprintTool,
  fingerprintFile,
  fingerprintToolKnownMissing,
  parseFpcalcJson,
  parseRawFingerprint,
  resetFingerprintToolForTests,
} from "./audioFingerprintTool";

type Callback = (err: Error | null, stdout?: string) => void;
type Handler = (command: string, args: string[]) => { stdout: string } | Error;

/** Chaque commande bouchonnée répond selon le scénario du test. */
function scenario(handler: Handler): void {
  mocks.execFile.mockImplementation(
    (command: string, args: string[], _opts: unknown, cb: Callback) => {
      const out = handler(command, args);
      if (out instanceof Error) cb(out);
      else cb(null, out.stdout);
    },
  );
}

const missing = () => Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });

let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetFingerprintToolForTests();
  mocks.execFile.mockReset();
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  info.mockRestore();
  warn.mockRestore();
});

describe("detectFingerprintTool", () => {
  it("fpcalc présent : retenu, journalisé une fois, jamais re-cherché", async () => {
    scenario((command) => (command === "fpcalc" ? { stdout: "fpcalc version 1.5.1\n" } : missing()));
    expect(await detectFingerprintTool()).toEqual({ kind: "fpcalc", command: "fpcalc" });
    expect(await detectFingerprintTool()).toEqual({ kind: "fpcalc", command: "fpcalc" });
    expect(mocks.execFile).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("fpcalc version 1.5.1"));
    expect(fingerprintToolKnownMissing()).toBe(false);
  });

  it("sans fpcalc, ffmpeg compilé avec chromaprint prend le relais", async () => {
    scenario((command, args) => {
      if (command === "ffmpeg" && args.includes("-muxers")) return { stdout: "  E chromaprint     Chromaprint\n" };
      return missing();
    });
    expect(await detectFingerprintTool()).toEqual({ kind: "ffmpeg", command: "ffmpeg" });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("ffmpeg"));
  });

  it("aucun outil : null, un avertissement, et l'absence est connue", async () => {
    expect(fingerprintToolKnownMissing()).toBe(false);
    scenario(() => missing());
    expect(await detectFingerprintTool()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("apk add chromaprint"));
    expect(fingerprintToolKnownMissing()).toBe(true);
  });

  it("un ffmpeg sans chromaprint ne compte pas", async () => {
    scenario((command, args) => {
      if (command === "ffmpeg" && args.includes("-muxers")) return { stdout: "  E mp4    MP4\n" };
      return missing();
    });
    expect(await detectFingerprintTool()).toBeNull();
  });
});

describe("les parseurs", () => {
  it("fpcalc : les entiers signés des vieilles versions redeviennent des uint32", () => {
    const result = parseFpcalcJson('{"duration": 600.1, "fingerprint": [1, -1, 2147483648]}');
    expect(Array.from(result.points)).toEqual([1, 4_294_967_295, 2_147_483_648]);
    expect(result.durationS).toBe(600.1);
  });

  it("fpcalc : sans durée, elle se déduit de la grille ; sans empreinte, on refuse", () => {
    const points = new Array(808).fill(7);
    const result = parseFpcalcJson(JSON.stringify({ fingerprint: points }));
    expect(result.durationS).toBeCloseTo(808 / POINTS_PER_SECOND, 5);
    expect(() => parseFpcalcJson('{"duration": 3}')).toThrow();
    expect(() => parseFpcalcJson('{"fingerprint": [1.5]}')).toThrow();
  });

  it("ffmpeg : des uint32 petit-boutistes, et rien de tronqué", () => {
    const result = parseRawFingerprint(Buffer.from([1, 0, 0, 0, 255, 255, 255, 255]));
    expect(Array.from(result.points)).toEqual([1, 4_294_967_295]);
    expect(result.durationS).toBeCloseTo(2 / POINTS_PER_SECOND, 5);
    expect(() => parseRawFingerprint(Buffer.from([1, 0, 0]))).toThrow();
  });
});

describe("fingerprintFile", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tentacle-fp-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("fpcalc reçoit -raw -json et TOUJOURS -length, avec cinq secondes de marge", async () => {
    let seen: string[] = [];
    scenario((_command, args) => {
      seen = args;
      return { stdout: '{"duration": 600.0, "fingerprint": [5, 6]}' };
    });
    const result = await fingerprintFile({ kind: "fpcalc", command: "fpcalc" }, "/tmp/x.mp3", 600, dir);
    expect(seen).toEqual(["-raw", "-json", "-length", "605", "/tmp/x.mp3"]);
    expect(Array.from(result.points)).toEqual([5, 6]);
  });

  it("ffmpeg écrit le brut dans le dossier de travail, mono à 11 025 Hz, et on le relit", async () => {
    let seen: string[] = [];
    scenario((command, args) => {
      if (command !== "ffmpeg") return missing();
      seen = args;
      return { stdout: "" };
    });
    // Le bouchon ne lance pas ffmpeg : on pose le fichier qu'il aurait écrit.
    await writeFile(join(dir, "fingerprint.bin"), Buffer.from([9, 0, 0, 0]));
    const result = await fingerprintFile({ kind: "ffmpeg", command: "ffmpeg" }, "/tmp/x.mp3", 600, dir);
    expect(seen).toEqual([
      "-v", "error", "-y", "-i", "/tmp/x.mp3", "-ac", "1", "-ar", "11025",
      "-f", "chromaprint", "-fp_format", "raw", join(dir, "fingerprint.bin"),
    ]);
    expect(Array.from(result.points)).toEqual([9]);
  });
});
