import { describe, expect, it } from "vitest";
import { choosePairingUrl, derivedPrivateUrl, type PairingRequestView } from "./pairingAddress";

const lan = (host: string | undefined, protocol = "http"): PairingRequestView => ({ clientIsPrivate: true, protocol, host });

describe("l'adresse déduite de la requête d'un client du réseau local", () => {
  it("reprend l'hôte et le port par lesquels il nous joint", () => {
    expect(derivedPrivateUrl(lan("192.168.1.20:3000"))).toBe("http://192.168.1.20:3000");
    expect(derivedPrivateUrl(lan("NAS.local:8080"))).toBe("http://nas.local:8080");
    expect(derivedPrivateUrl(lan("[fd00::20]:3000"))).toBe("http://[fd00::20]:3000");
    expect(derivedPrivateUrl(lan("tentacle.maison.lan", "https"))).toBe("https://tentacle.maison.lan");
  });

  it("un port par défaut n'est pas écrit", () => {
    expect(derivedPrivateUrl(lan("192.168.1.20:80"))).toBe("http://192.168.1.20");
    expect(derivedPrivateUrl(lan("192.168.1.20:443", "https"))).toBe("https://192.168.1.20");
  });

  it("rien pour un hôte que seul le serveur connaît : une TV ne le résoudrait pas", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "tentacle:3000", "host.docker.internal:3000", "app.localhost"]) {
      expect(derivedPrivateUrl(lan(host))).toBeNull();
    }
  });

  it("rien pour un client d'Internet, un hôte absent ou illisible", () => {
    expect(derivedPrivateUrl({ clientIsPrivate: false, protocol: "http", host: "192.168.1.20:3000" })).toBeNull();
    expect(derivedPrivateUrl(lan(undefined))).toBeNull();
    expect(derivedPrivateUrl(lan("a b:3000"))).toBeNull();
    expect(derivedPrivateUrl(lan("192.168.1.20:3000", "ws"))).toBeNull();
  });
});

describe("l'adresse donnée à la TV au jumelage", () => {
  const view = lan("192.168.1.20:3000");

  it("accès extérieur allumé : le lien public, sinon l'adresse privée réglée, sinon la déduite", () => {
    expect(choosePairingUrl({ exposed: true, publicUrl: "https://tv.example.com", localUrl: "http://10.0.0.2:3000", view })).toBe("https://tv.example.com");
    expect(choosePairingUrl({ exposed: true, publicUrl: null, localUrl: "http://10.0.0.2:3000", view })).toBe("http://10.0.0.2:3000");
    expect(choosePairingUrl({ exposed: true, publicUrl: null, localUrl: null, view })).toBe("http://192.168.1.20:3000");
  });

  it("coupé : l'adresse privée réglée, sinon le lien réglé, sinon la déduite", () => {
    expect(choosePairingUrl({ exposed: false, publicUrl: "https://tv.example.com", localUrl: "http://10.0.0.2:3000", view })).toBe("http://10.0.0.2:3000");
    expect(choosePairingUrl({ exposed: false, publicUrl: "https://tv.example.com", localUrl: null, view })).toBe("https://tv.example.com");
    expect(choosePairingUrl({ exposed: false, publicUrl: null, localUrl: null, view })).toBe("http://192.168.1.20:3000");
  });

  it("rien de réglé ni de déductible : aucune adresse (le client se rabat sur la sienne)", () => {
    expect(choosePairingUrl({ exposed: false, publicUrl: null, localUrl: null })).toBeNull();
    expect(choosePairingUrl({ exposed: true, publicUrl: null, localUrl: null, view: lan("localhost:5173") })).toBeNull();
  });
});
