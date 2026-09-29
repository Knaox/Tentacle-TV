/**
 * Le manifeste que le serveur tient pour vrai : celui de l'image, remplacé par
 * une révision PLUS HAUTE et SANS FAUTE lue sur GitHub, gardée sur disque pour
 * survivre à un redémarrage hors ligne.
 */

import { existsSync, rmSync } from "fs";
import { join } from "path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le dossier de données est fixé AVANT les imports (vi.hoisted) : `DATA_ROOT` se lit au chargement.
const dir = vi.hoisted(() => {
  const path = `${process.env.TMPDIR ?? "/tmp"}/l32-manifest-${String(process.pid)}`;
  process.env.TENTACLE_DATA_DIR = path;
  process.env.TENTACLE_COMPAT_MANIFEST_URL = "https://raw.test/compat/jellyfin.json";
  return path;
});

import { getCompatManifestState, refreshCompatManifest, resetCompatManifestForTests } from "./manifestStore";

const published = (revision: number, extra: Record<string, unknown> = {}) => ({
  schema: 1,
  revision,
  lines: [],
  features: [{ id: "auth.header", area: "auth", critical: true, label: { fr: "Connexion", en: "Sign-in" } }],
  versions: [{ version: "12.1.0", verdict: "ok", features: { "auth.header": "ok" } }],
  ...extra,
});

const remote = vi.fn();
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { etag: '"r"' } });

beforeEach(() => {
  vi.stubGlobal("fetch", remote);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  remote.mockReset();
  resetCompatManifestForTests();
  rmSync(dir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function later(ms: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + ms);
}

describe("manifeste de compatibilité", () => {
  it("sans rien de publié, celui de l'image — trouvé en remontant jusqu'à compat/", () => {
    const state = getCompatManifestState();
    expect(state.source).toBe("embedded");
    expect(state.manifest?.schema).toBe(1);
  });

  it("adopte une révision publiée plus haute, et la garde sur disque", async () => {
    remote.mockResolvedValueOnce(json(published(900)));
    await refreshCompatManifest();
    expect(getCompatManifestState()).toMatchObject({ source: "remote", manifest: { revision: 900 }, remoteError: null });
    expect(existsSync(join(dir, "compat", "jellyfin.json"))).toBe(true);

    // Redémarrage sans réseau : la révision gardée l'emporte sur celle de l'image.
    resetCompatManifestForTests();
    expect(getCompatManifestState()).toMatchObject({ source: "remote", manifest: { revision: 900 } });
  });

  it("n'adopte jamais une révision égale ou plus basse", async () => {
    remote.mockResolvedValueOnce(json(published(900)));
    await refreshCompatManifest();
    remote.mockResolvedValueOnce(json(published(899, { versions: [] })));
    later(31_000);
    await refreshCompatManifest(true);
    expect(getCompatManifestState().manifest?.versions).toHaveLength(1);
  });

  it("un manifeste publié avec UNE faute ne remplace rien, et on le dit", async () => {
    remote.mockResolvedValueOnce(json(published(901, { versions: [{ version: "12.1.0", verdict: "maybe", features: {} }] })));
    await refreshCompatManifest();
    expect(getCompatManifestState()).toMatchObject({ source: "embedded", remoteError: "invalid" });
  });

  it("un fichier absent de main (404) ou un réseau muet laissent l'embarqué", async () => {
    remote.mockResolvedValueOnce(new Response("404: Not Found", { status: 404 }));
    await refreshCompatManifest();
    expect(getCompatManifestState()).toMatchObject({ source: "embedded", remoteError: "HTTP 404" });
    remote.mockRejectedValueOnce(new TypeError("fetch failed"));
    later(7 * 3600_000);
    await refreshCompatManifest();
    expect(getCompatManifestState()).toMatchObject({ source: "embedded", remoteError: "unreachable" });
  });

  it("relit au plus toutes les six heures, et « Revérifier » au plus toutes les trente secondes", async () => {
    remote.mockResolvedValue(json(published(900)));
    await refreshCompatManifest();
    await refreshCompatManifest();
    await refreshCompatManifest(true);
    expect(remote).toHaveBeenCalledTimes(1);
    later(31_000);
    await refreshCompatManifest(true);
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it("`off` coupe la lecture distante", async () => {
    process.env.TENTACLE_COMPAT_MANIFEST_URL = "off";
    try {
      await refreshCompatManifest(true);
      expect(remote).not.toHaveBeenCalled();
    } finally {
      process.env.TENTACLE_COMPAT_MANIFEST_URL = "https://raw.test/compat/jellyfin.json";
    }
  });
});
