import { describe, expect, it } from "vitest";
import { isLocalBrowserHost, judgeClient, type ClientFacts } from "./directClient";

const facts = (over: Partial<ClientFacts> = {}): ClientFacts => ({
  peer: "172.16.1.20",
  realIp: "172.16.1.20",
  headers: {},
  browserHost: "172.16.1.30",
  gateway: "172.18.0.1",
  ownAddresses: ["172.18.0.5"],
  ...over,
});

describe("qui arrive directement du réseau local", () => {
  it("une adresse privée, sans mandataire, vers une adresse locale : local", () => {
    expect(judgeClient(facts())).toBe("local");
    expect(judgeClient(facts({ peer: "::ffff:192.168.1.5", realIp: "192.168.1.5" }))).toBe("local");
    expect(judgeClient(facts({ peer: "fd12::5", realIp: "fd12::5", browserHost: "[fd12::1]" }))).toBe("local");
    expect(judgeClient(facts({ peer: "fe80::5%eth0", realIp: "fe80::5", browserHost: "nas.local" }))).toBe("local");
    expect(judgeClient(facts({ peer: "127.0.0.1", realIp: "127.0.0.1", browserHost: "localhost" }))).toBe("local");
  });

  it("une adresse publique : le code", () => {
    expect(judgeClient(facts({ peer: "8.8.8.8", realIp: "8.8.8.8" }))).toBe("public");
    // Le CGNAT et Tailscale ne sont pas « la maison ».
    expect(judgeClient(facts({ peer: "100.101.102.103", realIp: "100.101.102.103" }))).toBe("public");
  });

  it("la passerelle du conteneur (Docker Desktop, colima, relais IPv6) masque l'adresse : inconnue", () => {
    expect(judgeClient(facts({ peer: "172.18.0.1", realIp: "172.18.0.1" }))).toBe("unknown");
    // Même avec un en-tête de relais : par la passerelle, Internet pourrait le poser lui-même.
    expect(judgeClient(facts({ peer: "172.18.0.1", realIp: "192.168.1.5", headers: { "x-forwarded-for": "192.168.1.5" } }))).toBe("unknown");
  });

  it("l'adresse propre du conteneur (rootlessport de Podman sans racine) masque l'adresse : inconnue", () => {
    // Relevé le 2026-10-08 : réseau de pont de Podman, l'hôte comme le réseau local arrivent de 10.89.3.2.
    const podman = { gateway: "10.89.3.1", ownAddresses: ["10.89.3.2", "fe80::34ec:6dff:feaa:7b38"] };
    expect(judgeClient(facts({ ...podman, peer: "::ffff:10.89.3.2", realIp: "10.89.3.2" }))).toBe("unknown");
    // Un en-tête de relais n'y change rien : Internet pourrait le poser lui-même.
    expect(judgeClient(facts({ ...podman, peer: "10.89.3.2", realIp: "192.168.1.5", headers: { "x-forwarded-for": "192.168.1.5" } }))).toBe("unknown");
    expect(judgeClient(facts({ ...podman, peer: "fe80::34ec:6dff:feaa:7b38%eth0", realIp: "fe80::34ec:6dff:feaa:7b38" }))).toBe("unknown");
    // Un voisin du même réseau de pont garde son adresse : local.
    expect(judgeClient(facts({ ...podman, peer: "10.89.3.7", realIp: "10.89.3.7" }))).toBe("local");
    // Hors conteneur, aucune adresse propre n'est écartée.
    expect(judgeClient(facts({ gateway: null, ownAddresses: [], peer: "192.168.1.5", realIp: "192.168.1.5" }))).toBe("local");
  });

  it("un mandataire voisin de confiance qui transmet une adresse privée : local ; publique : le code", () => {
    const viaProxy = { peer: "172.18.0.7", headers: { "x-forwarded-for": "x" } };
    expect(judgeClient(facts({ ...viaProxy, realIp: "192.168.1.5" }))).toBe("local");
    expect(judgeClient(facts({ ...viaProxy, realIp: "203.0.113.9" }))).toBe("public");
  });

  it("un en-tête de relais venu d'un inconnu : on ne le croit pas", () => {
    expect(judgeClient(facts({ peer: "203.0.113.9", realIp: "203.0.113.9", headers: { "x-forwarded-for": "192.168.1.5" } }))).toBe("unknown");
  });

  it("un en-tête que le serveur ne lit pas (Forwarded seul) : inconnue", () => {
    expect(judgeClient(facts({ peer: "172.18.0.7", realIp: "172.18.0.7", headers: { forwarded: "for=203.0.113.9" } }))).toBe("unknown");
  });

  it("un nom de domaine public dans le navigateur : on passe par Internet ou un mandataire", () => {
    expect(judgeClient(facts({ browserHost: "tentacle.example.com" }))).toBe("public");
  });

  it("les adresses tapées qui désignent la maison", () => {
    for (const host of ["192.168.1.2", "[fd00::2]", "nas", "nas.local", "media.lan", "tv.home.arpa", "localhost", "box.home"]) {
      expect(isLocalBrowserHost(host), host).toBe(true);
    }
    for (const host of ["8.8.8.8", "tentacle.example.com", "", undefined, "100.64.0.1"]) expect(isLocalBrowserHost(host), String(host)).toBe(false);
  });
});
