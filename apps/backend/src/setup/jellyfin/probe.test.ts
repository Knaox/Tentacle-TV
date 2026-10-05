import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { publicInfo, startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";

// La compatibilité réelle vient du manifeste : ici, « 10.8 » est trop vieux.
vi.mock("../../services/jellyfinCompat/compatVerdict", () => ({
  resolveCompat: (_manifest: unknown, version: string) => ({ status: version.startsWith("10.8") ? "incompatible" : "compatible" }),
}));

import { configureJellyfinGuard } from "./guardedFetch";
import { normalizeJellyfinUrl, probeJellyfin } from "./probe";

let jf: FakeJellyfin;
beforeAll(async () => {
  jf = await startFakeJellyfin();
});
afterAll(() => jf.close());
beforeEach(() => configureJellyfinGuard({ allowLoopback: true }));

const codeOf = async (run: () => unknown) => {
  try {
    await run();
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
};

describe("adresse saisie", () => {
  it("ramenée à sa base", () => {
    expect(normalizeJellyfinUrl(" 192.168.1.10:8096 ")).toBe("http://192.168.1.10:8096");
    expect(normalizeJellyfinUrl("https://jf.example.com/jellyfin/?x=1#y")).toBe("https://jf.example.com/jellyfin");
    expect(normalizeJellyfinUrl("http://jellyfin:8096/")).toBe("http://jellyfin:8096");
  });

  it("refusée : autre protocole, identifiants, vide, absurde", async () => {
    for (const bad of ["ftp://x", "file:///etc/passwd", "http://user:pw@host", "", "javascript:alert(1)", "http://"]) {
      expect(await codeOf(() => normalizeJellyfinUrl(bad)), bad).toBe("jf_invalid_url");
    }
  });

  it("dans Docker, « localhost » est expliqué", async () => {
    configureJellyfinGuard({ allowLoopback: false });
    expect(await codeOf(() => normalizeJellyfinUrl("http://localhost:8096"))).toBe("jf_localhost_in_docker");
    expect(await codeOf(() => normalizeJellyfinUrl("127.0.0.1:8096"))).toBe("jf_localhost_in_docker");
  });
});

describe("sonde", () => {
  it("vierge ou configuré, compatible ou non — et rien d'autre", async () => {
    jf.on("GET /System/Info/Public", publicInfo({ StartupWizardCompleted: false }));
    const blank = await probeJellyfin(jf.url);
    expect(blank).toEqual({
      url: jf.url, id: "4b9f0e0c6a1f4d2c9a7e5b3d1f0e2c4a", version: "10.11.11", serverName: "jellyfin", blank: true, compatible: true,
    });
    jf.on("GET /System/Info/Public", publicInfo({ Version: "10.8.13" }));
    expect(await probeJellyfin(jf.url)).toMatchObject({ blank: false, compatible: false });
  });

  it("Emby, une page web, une réponse incomplète : pas un Jellyfin", async () => {
    jf.on("GET /System/Info/Public", publicInfo({ ProductName: "Emby Server" }));
    expect(await codeOf(() => probeJellyfin(jf.url))).toBe("jf_not_jellyfin");
    jf.on("GET /System/Info/Public", { status: 200, raw: "<html></html>", headers: { "Content-Type": "text/html" } });
    expect(await codeOf(() => probeJellyfin(jf.url))).toBe("jf_not_jellyfin");
    jf.on("GET /System/Info/Public", { status: 200, json: { Version: "10.11.11" } });
    expect(await codeOf(() => probeJellyfin(jf.url))).toBe("jf_not_jellyfin");
  });

  it("suit UNE redirection sur le même hôte, et garde l'adresse d'arrivée", async () => {
    jf.on("GET /System/Info/Public", { status: 301, headers: { Location: "/jellyfin/System/Info/Public" } });
    jf.on("GET /jellyfin/System/Info/Public", publicInfo());
    expect((await probeJellyfin(jf.url)).url).toBe(`${jf.url}/jellyfin`);
  });

  it("refuse une redirection vers un autre hôte", async () => {
    jf.on("GET /System/Info/Public", { status: 302, headers: { Location: "http://169.254.169.254/System/Info/Public" } });
    expect(await codeOf(() => probeJellyfin(jf.url))).toBe("jf_not_jellyfin");
  });
});
