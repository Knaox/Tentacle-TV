import { describe, expect, it } from "vitest";
import { getRealClientIp } from "./networkUtils";
import { buildTrustList, isTrustedProxy } from "./trustedProxies";

describe("mandataires de confiance", () => {
  it("les voisins seulement : machine, réseau local, réseaux de Docker", () => {
    for (const ip of ["127.0.0.1", "10.0.0.2", "172.18.0.5", "192.168.1.1", "::1", "fd00::5", "::ffff:172.18.0.5"]) {
      expect(isTrustedProxy(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "100.64.1.1", "172.32.0.1", "2001:db8::1", "", undefined]) {
      expect(isTrustedProxy(ip), String(ip)).toBe(false);
    }
  });

  it("TRUSTED_PROXIES ajoute des adresses et des blocs ; une entrée absurde est ignorée", () => {
    const list = buildTrustList(" 173.245.48.0/20, 203.0.113.7, n'importe-quoi, 10.0.0.0/99 ");
    expect(isTrustedProxy("173.245.50.1", list)).toBe(true);
    expect(isTrustedProxy("203.0.113.7", list)).toBe(true);
    expect(isTrustedProxy("203.0.113.8", list)).toBe(false);
  });
});

describe("adresse réelle du client", () => {
  const headers = { "cf-connecting-ip": "198.51.100.9", "x-real-ip": "198.51.100.10" };

  it("crue d'un mandataire voisin (Cloudflare → NPM → Tentacle)", () => {
    expect(getRealClientIp({ ip: "172.18.0.2", headers, socket: { remoteAddress: "172.18.0.2" } })).toBe("198.51.100.9");
    expect(getRealClientIp({ ip: "172.18.0.2", headers: { "x-real-ip": "198.51.100.10" }, socket: { remoteAddress: "172.18.0.2" } })).toBe("198.51.100.10");
  });

  it("jamais d'un client d'Internet qui pose l'en-tête lui-même", () => {
    expect(getRealClientIp({ ip: "203.0.113.50", headers, socket: { remoteAddress: "203.0.113.50" } })).toBe("203.0.113.50");
    expect(getRealClientIp({ ip: "203.0.113.50", headers })).toBe("203.0.113.50");
  });
});
