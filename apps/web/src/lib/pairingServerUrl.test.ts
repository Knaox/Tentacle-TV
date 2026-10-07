import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ desktop: false, base: "" }));
vi.mock("../desktop/bridge", () => ({ isDesktopApp: () => h.desktop }));
vi.mock("./backendBase", () => ({ getBackendBase: () => h.base }));

import { clientServerUrl, fetchPairingServerUrl } from "./pairingServerUrl";

/**
 * Le jumelage d'une TV sans lien public : l'adresse annoncée par le serveur
 * d'abord, sinon celle par laquelle la page lui parle — jamais l'origine
 * propre à la coquille de bureau.
 */

function config(publicUrl: string | null | undefined) {
  return vi.fn(async () => ({ ok: true, json: async () => (publicUrl === undefined ? {} : { publicUrl }) }));
}

beforeEach(() => {
  h.desktop = false;
  h.base = "";
  vi.stubGlobal("window", { location: { origin: "http://192.168.1.20:3000" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("l'adresse par laquelle la page joint le serveur", () => {
  it("web : l'origine de la page, sauf base de build", () => {
    expect(clientServerUrl()).toBe("http://192.168.1.20:3000");
    h.base = "https://api.example.com";
    expect(clientServerUrl()).toBe("https://api.example.com");
  });

  it("bureau : l'URL serveur sauvegardée, jamais l'origine de l'application", () => {
    h.desktop = true;
    vi.stubGlobal("window", { location: { origin: "tentacle://app" } });
    expect(clientServerUrl()).toBe("");
    h.base = "http://nas.local:3000";
    expect(clientServerUrl()).toBe("http://nas.local:3000");
  });
});

describe("l'adresse transmise à la TV", () => {
  it("celle que le serveur annonce", async () => {
    vi.stubGlobal("fetch", config("https://tv.example.com"));
    expect(await fetchPairingServerUrl()).toBe("https://tv.example.com");
  });

  it("sans lien public (serveur d'avant, rien de réglé) : l'origine de la page", async () => {
    vi.stubGlobal("fetch", config(null));
    expect(await fetchPairingServerUrl()).toBe("http://192.168.1.20:3000");
    vi.stubGlobal("fetch", config(undefined));
    expect(await fetchPairingServerUrl()).toBe("http://192.168.1.20:3000");
  });

  it("un /api/config muet n'empêche rien : l'adresse de la page reste", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchPairingServerUrl()).toBe("http://192.168.1.20:3000");
  });

  it("bureau sans serveur, ou page ouverte par localhost : aucune", async () => {
    vi.stubGlobal("fetch", config(null));
    h.desktop = true;
    expect(await fetchPairingServerUrl()).toBeNull();
    h.desktop = false;
    vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
    expect(await fetchPairingServerUrl()).toBeNull();
  });
});
