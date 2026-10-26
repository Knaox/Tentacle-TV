import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArtCache, ownerDirOf } from "./artCache";
import { ART_UNTAGGED_MAX_AGE_MS } from "./artCachePolicy";

/**
 * Octave — une pochette ne se charge qu'UNE fois : servie depuis le disque
 * ensuite, après une relance comme sans réseau ; jamais une page d'erreur
 * gardée pour une image ; tout part à la déconnexion.
 */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(7)]);
const SRV = "http://srv:3001/api/music/artwork/abc?tag=t1&size=128";
const roots: string[] = [];

function setup(fetchUpstream = vi.fn(async (_url: string, _max: number): Promise<Uint8Array | null> => JPEG), now = () => Date.now()) {
  const root = mkdtempSync(path.join(tmpdir(), "octave-art-"));
  roots.push(root);
  return { root, fetchUpstream, cache: createArtCache({ root, fetchUpstream, now }) };
}

afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("le cache disque des pochettes", () => {
  it("demandée une fois ; ensuite le disque, même avec un jeton renouvelé", async () => {
    const { cache, fetchUpstream } = setup();
    const first = await cache.serve("srv|u1", `${SRV}&api_key=A`);
    expect(first).toMatchObject({ type: "image/jpeg", fromDisk: false });
    const second = await cache.serve("srv|u1", `${SRV}&api_key=B`);
    expect(second?.fromDisk).toBe(true);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it("après une relance (un cache neuf sur le même dossier) et sans réseau : servie depuis le disque", async () => {
    const { root, cache } = setup();
    await cache.serve("srv|u1", SRV);
    const offline = vi.fn(async () => null);
    const relaunched = createArtCache({ root, fetchUpstream: offline });
    expect((await relaunched.serve("srv|u1", SRV))?.fromDisk).toBe(true);
    expect(offline).not.toHaveBeenCalled();
  });

  it("des demandes simultanées ne font qu'une requête", async () => {
    const { cache, fetchUpstream } = setup();
    await Promise.all([cache.serve("o", SRV), cache.serve("o", SRV), cache.serve("o", SRV)]);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it("rangé par identité : une autre identité a sa propre entrée", async () => {
    const { root, cache, fetchUpstream } = setup();
    await cache.serve("srv|u1", SRV);
    await cache.serve("srv|u2", SRV);
    expect(fetchUpstream).toHaveBeenCalledTimes(2);
    expect(readdirSync(root).sort()).toEqual([ownerDirOf("srv|u1"), ownerDirOf("srv|u2")].sort());
  });

  it("jamais une page d'erreur gardée pour une image, ni une adresse refusée demandée", async () => {
    const html = vi.fn(async () => new TextEncoder().encode("<html>404 introuvable</html>"));
    const { cache } = setup(html);
    expect(await cache.serve("o", SRV)).toBeNull();
    expect(await cache.serve("o", "file:///etc/passwd")).toBeNull();
    expect(html).toHaveBeenCalledTimes(1);
  });

  it("une image sans étiquette se relit après 30 jours", async () => {
    let t = Date.now();
    const { cache, fetchUpstream } = setup(undefined, () => t);
    await cache.serve("o", "https://img.test/a.jpg");
    t += ART_UNTAGGED_MAX_AGE_MS + 60_000;
    await cache.serve("o", "https://img.test/a.jpg");
    expect(fetchUpstream).toHaveBeenCalledTimes(2);
  });

  it("la déconnexion efface tout", async () => {
    const { cache, fetchUpstream } = setup();
    await cache.serve("o", SRV);
    await cache.clear();
    await cache.serve("o", SRV);
    expect(fetchUpstream).toHaveBeenCalledTimes(2);
  });
});
