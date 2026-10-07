import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ config: new Map<string, string>(), envUrl: null as string | null }));
vi.mock("../services/db", () => ({ hasPrisma: () => true }));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => h.config.get(key),
  setConfigValue: async (key: string, value: string) => void h.config.set(key, value),
  getPublicUrl: () => h.config.get("public_url") ?? h.envUrl,
  getDirectStreamingConfig: () => ({
    enabled: h.config.get("direct_streaming_enabled") === "true",
    publicUrl: h.config.get("jellyfin_public_url") ?? null,
    privateUrl: h.config.get("jellyfin_private_url") ?? null,
  }),
}));

import { applyExposureDefault, EXPOSURE_MIGRATION_KEY } from "./exposureDefault";

beforeEach(() => {
  h.config.clear();
  h.envUrl = null;
});

describe("« Accès depuis l'extérieur » au premier démarrage de cette version", () => {
  it("un serveur neuf, ou qui ne publiait rien : coupé — rien d'exposé par défaut", async () => {
    expect(await applyExposureDefault()).toBe("applied");
    expect(h.config.get("remote_access_enabled")).toBeUndefined();
    expect(h.config.has(EXPOSURE_MIGRATION_KEY)).toBe(true);
  });

  it.each([
    ["son lien public", { public_url: "https://tv.example.com" }],
    ["l'adresse publique de la lecture directe", { direct_streaming_enabled: "true", jellyfin_public_url: "https://jf.example.com" }],
  ])("un serveur d'avant qui publiait %s : allumé, rien ne change pour lui", async (_name, config) => {
    for (const [key, value] of Object.entries(config)) h.config.set(key, value);
    await applyExposureDefault();
    expect(h.config.get("remote_access_enabled")).toBe("true");
  });

  it("le lien public de l'environnement compte aussi (TENTACLE_PUBLIC_URL)", async () => {
    h.envUrl = "https://tv.example.com";
    await applyExposureDefault();
    expect(h.config.get("remote_access_enabled")).toBe("true");
  });

  it("une fois passée, le choix de l'administrateur est respecté pour toujours", async () => {
    await applyExposureDefault();
    h.config.set("public_url", "https://tv.example.com");
    h.config.set("remote_access_enabled", "false");
    expect(await applyExposureDefault()).toBe("already");
    expect(h.config.get("remote_access_enabled")).toBe("false");
  });
});
