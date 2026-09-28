import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le lien public d'une liste et la feuille de partage du système. Le bureau
 * est figé au chargement de `desktop/detect` : chaque cas recharge les modules
 * après avoir posé (ou non) le pont de la coquille.
 */

let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null });
  // Le web vise sa propre origine tant qu'aucun backend n'est imposé au build.
  vi.stubEnv("VITE_BACKEND_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function load(options: { desktop: boolean; share?: unknown }) {
  vi.stubGlobal("window", {
    location: { origin: options.desktop ? "tentacle://app" : "https://tv.example" },
    ...(options.desktop ? { tentacle: { platform: "darwin" } } : {}),
  });
  vi.stubGlobal("navigator", options.share === undefined ? {} : { share: options.share });
  return import("./share");
}

describe("shareListUrl", () => {
  it("vise le serveur public sur le bureau, jamais tentacle://app", async () => {
    storage.set("tentacle_server_url", "https://poulpy.example/");
    const { shareListUrl } = await load({ desktop: true });
    expect(shareListUrl("tok")).toBe("https://poulpy.example/share/tok");
  });

  it("garde l'origine de la page sur le web", async () => {
    const { shareListUrl } = await load({ desktop: false });
    expect(shareListUrl("tok")).toBe("https://tv.example/share/tok");
  });
});

describe("canShareNatively", () => {
  it("suit la présence de navigator.share sur le web", async () => {
    expect((await load({ desktop: false, share: vi.fn() })).canShareNatively()).toBe(true);
    vi.resetModules();
    expect((await load({ desktop: false })).canShareNatively()).toBe(false);
  });

  it("ne la propose jamais sur le bureau, même si elle apparaissait", async () => {
    expect((await load({ desktop: true, share: vi.fn() })).canShareNatively()).toBe(false);
  });
});

describe("shareNatively", () => {
  const named = (name: string) => Object.assign(new Error(name), { name });

  it("distingue le partage fait, la feuille refermée et le refus", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const { shareNatively } = await load({ desktop: false, share });
    await expect(shareNatively({ url: "https://tv.example/share/tok" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ url: "https://tv.example/share/tok" });

    share.mockRejectedValueOnce(named("AbortError"));
    await expect(shareNatively({ url: "u" })).resolves.toBe("dismissed");

    // Safari, geste expiré pendant la création du lien : la copie prendra le relais.
    share.mockRejectedValueOnce(named("NotAllowedError"));
    await expect(shareNatively({ url: "u" })).resolves.toBe("failed");
  });
});
