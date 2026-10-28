/**
 * Le cache des pochettes ne nomme un fichier que d'un identifiant Jellyfin normalisé et d'une étiquette
 * alphanumérique, toujours dans son dossier : un identifiant qui sort du dossier est servi sans cache.
 */

import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/dataDir", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  return { DATA_ROOT: fs.mkdtempSync(path.join(os.tmpdir(), "tentacle-artwork-")) };
});

const jfRaw = vi.fn(async () => new Response(Buffer.from("jpeg"), { headers: { "content-type": "image/jpeg" } }));
vi.mock("../jellyfin/musicJellyfin", () => ({ jfRaw: (...args: unknown[]) => jfRaw(...(args as [])), q: encodeURIComponent }));

import { DATA_ROOT } from "../../services/dataDir";
import { artworkFor } from "./artworkCache";

const ID = "0123456789abcdef0123456789abcdef";
const cacheDir = () => join(DATA_ROOT, "cache", "music-artwork");

describe("cache des pochettes", () => {
  beforeEach(() => jfRaw.mockClear());

  it("un identifiant normalisé est gardé, puis relu sans Jellyfin", async () => {
    expect(await artworkFor(ID, "abc123", 256)).toMatchObject({ immutable: true });
    expect(readdirSync(cacheDir())).toContain(`${ID}-abc123-256.jpg`);
    expect(await artworkFor(ID, "abc123", 256)).toMatchObject({ immutable: true });
    expect(jfRaw).toHaveBeenCalledTimes(1);
  });

  it("un identifiant qui sortirait du dossier est servi sans rien écrire", async () => {
    const outside = mkdtempSync(join(tmpdir(), "tentacle-artwork-outside-"));
    const escape = `../../../../${outside.replace(/^\//, "")}/x`;
    const image = await artworkFor(escape, "abc123", 256);
    expect(image).toMatchObject({ immutable: false });
    expect(readdirSync(outside)).toEqual([]);
    expect(existsSync(join(cacheDir(), `${escape}-abc123-256.jpg`))).toBe(false);
  });
});
