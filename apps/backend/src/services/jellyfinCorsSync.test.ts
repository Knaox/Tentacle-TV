import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: new Map<string, string>(),
  publicUrl: "https://tv.example.com" as string | null,
  injected: [] as string[][],
  fail: false,
}));
vi.mock("./configStore", () => ({
  getConfigValue: (key: string) => h.config.get(key),
  getJellyfinUrl: () => "http://jellyfin:8096",
  getJellyfinApiKey: () => "key",
  getPublicUrl: () => h.publicUrl,
}));
vi.mock("./jellyfinHealth", () => ({ onJellyfinHealth: () => () => undefined }));
vi.mock("./jellyfinCors", async (original) => ({
  ...(await original<typeof import("./jellyfinCors")>()),
  injectCorsHosts: async (_url: string, _key: string, origins: string[]) => {
    if (h.fail) throw new Error("ECONNREFUSED");
    h.injected.push(origins);
    return { added: origins.slice(0, 1), alreadyPresent: [], open: false };
  },
}));

import { isHomeOrigin, syncJellyfinCors, tentacleCorsOrigins } from "./jellyfinCorsSync";

beforeEach(() => {
  h.config.clear();
  h.publicUrl = "https://tv.example.com";
  h.injected = [];
  h.fail = false;
});

describe("les origines de Tentacle pour Jellyfin", () => {
  it("le lien public, l'adresse locale, la page, puis les applications de bureau — en origines, sans doublon", () => {
    expect(tentacleCorsOrigins({ publicUrl: "https://tv.example.com/", localUrl: "http://192.168.1.20:3000", extra: ["https://tv.example.com"] })).toEqual([
      "https://tv.example.com",
      "http://192.168.1.20:3000",
      "tentacle://app",
      "tauri://localhost",
      "https://tauri.localhost",
      "http://tauri.localhost",
    ]);
  });

  it("une origine de la maison est inscrite d'office ; une origine publique inconnue, seulement si un administrateur l'apporte", async () => {
    expect(isHomeOrigin("http://192.168.1.20:3000")).toBe(true);
    expect(isHomeOrigin("http://localhost:5173")).toBe(true);
    expect(isHomeOrigin("tentacle://app")).toBe(true);
    expect(isHomeOrigin("https://evil.example")).toBe(false);

    await syncJellyfinCors({ requestOrigin: "https://evil.example" });
    expect(h.injected.at(-1)).not.toContain("https://evil.example");
    await syncJellyfinCors({ requestOrigin: "https://admin.example.net", trustRequestOrigin: true });
    expect(h.injected.at(-1)).toContain("https://admin.example.net");
  });

  it("le rapport dit ce qui a été fait ; un Jellyfin muet ne fait jamais lever", async () => {
    expect(await syncJellyfinCors()).toMatchObject({ status: "updated", added: ["https://tv.example.com"] });
    h.fail = true;
    expect(await syncJellyfinCors()).toMatchObject({ status: "unreachable", added: [] });
  });
});
