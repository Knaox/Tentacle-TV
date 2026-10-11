import { describe, expect, it } from "vitest";
import { HOST_METHODS } from "../protocol";
import { createHostServices, type HostServiceDeps } from "./hostServices";

const idle = { phase: "idle", version: null, receivedBytes: 0, totalBytes: null, failure: null } as const;

function deps(overrides: Partial<HostServiceDeps> = {}): HostServiceDeps {
  return {
    detect: async () => ({ state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", port: 8096, canStart: false, installer: "available", installing: false }),
    install: () => ({ ...idle, phase: "resolving" }),
    installStatus: () => idle,
    start: async () => ({ started: true }),
    pickFolder: async (params) => ({ path: params.initial ?? "D:\\Films", unc: null }),
    log: () => undefined,
    ...overrides,
  };
}

describe("gestes servis par l'hôte", () => {
  it("annonce exactement les méthodes du contrat", () => {
    expect([...createHostServices(deps()).methods].sort()).toEqual([...HOST_METHODS].sort());
  });

  it("répond, et passe les paramètres relus", async () => {
    const services = createHostServices(deps());
    expect(await services.handle("jellyfin.start", undefined)).toEqual({ ok: true, result: { started: true } });
    expect(await services.handle("dialog.pickFolder", { initial: "E:\\Séries", junk: 1 })).toEqual({ ok: true, result: { path: "E:\\Séries", unc: null } });
  });

  it("une méthode inconnue ou un échec ne fait jamais tomber l'hôte", async () => {
    const services = createHostServices(deps({ detect: async () => Promise.reject(new Error("reg")) }));
    expect(await services.handle("toString", undefined)).toEqual({ ok: false, error: "unknown_method" });
    expect(await services.handle("jellyfin.detect", undefined)).toEqual({ ok: false, error: "failed" });
  });
});
