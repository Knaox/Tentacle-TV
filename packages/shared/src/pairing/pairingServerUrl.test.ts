import { describe, expect, it } from "vitest";
import { pairingServerUrl, reachableServerUrl } from "./pairingServerUrl";

describe("une adresse qu'une TV peut joindre", () => {
  it("http(s), avec ou sans port ni chemin, sans les / finaux", () => {
    expect(reachableServerUrl("http://192.168.1.20:3000")).toBe("http://192.168.1.20:3000");
    expect(reachableServerUrl("https://tv.example.com/")).toBe("https://tv.example.com");
    expect(reachableServerUrl(" https://maison.lan/tentacle// ")).toBe("https://maison.lan/tentacle");
    expect(reachableServerUrl("http://[fd00::20]:3000")).toBe("http://[fd00::20]:3000");
    expect(reachableServerUrl("HTTP://NAS.local:8080")).toBe("HTTP://NAS.local:8080");
  });

  it("jamais l'origine de la coquille de bureau, ni la machine elle-même", () => {
    for (const raw of ["tentacle://app", "tauri://localhost", "http://localhost:5173", "http://app.localhost", "http://127.0.0.1:3000", "http://[::1]:3000", "http://0.0.0.0:3000"]) {
      expect(reachableServerUrl(raw)).toBeNull();
    }
  });

  it("rien d'illisible ni de vide", () => {
    for (const raw of [null, undefined, "", "   ", "192.168.1.20:3000", "http://", "http://a b", "http://host:70000", "http://user@host"]) {
      expect(reachableServerUrl(raw)).toBeNull();
    }
  });
});

describe("l'adresse donnée à la TV au jumelage", () => {
  it("celle que le serveur annonce d'abord", () => {
    expect(pairingServerUrl({ advertised: "https://tv.example.com", clientServerUrl: "http://192.168.1.20:3000" })).toBe("https://tv.example.com");
  });

  it("sans lien public : celle par laquelle le client joint le serveur", () => {
    expect(pairingServerUrl({ advertised: null, clientServerUrl: "http://192.168.1.20:3000" })).toBe("http://192.168.1.20:3000");
    expect(pairingServerUrl({ advertised: undefined, clientServerUrl: "http://nas.local:3000/" })).toBe("http://nas.local:3000");
  });

  it("une annonce que la TV ne joindrait pas cède la place au client", () => {
    expect(pairingServerUrl({ advertised: "http://localhost:3000", clientServerUrl: "http://192.168.1.20:3000" })).toBe("http://192.168.1.20:3000");
  });

  it("rien de joignable : pas de jumelage (bureau sans serveur, navigateur ouvert en localhost)", () => {
    expect(pairingServerUrl({ advertised: null, clientServerUrl: "tentacle://app" })).toBeNull();
    expect(pairingServerUrl({ advertised: null, clientServerUrl: "http://localhost:5173" })).toBeNull();
    expect(pairingServerUrl({ advertised: null, clientServerUrl: "" })).toBeNull();
  });
});
