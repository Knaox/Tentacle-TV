import { describe, expect, it } from "vitest";
import { getRealClientIp, isPrivateIp } from "./networkUtils";

describe("isPrivateIp", () => {
  it("les réseaux d'un domicile et la machine sont « locaux »", () => {
    for (const ip of ["10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.20", "127.0.0.1", "169.254.3.4", "::1", "fd00::5", "fe80::1", "::ffff:192.168.1.20"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("100.64.0.0/10 (adresse partagée par l'opérateur, CGNAT) reste PUBLIC : ce n'est pas le réseau du domicile", () => {
    for (const ip of ["100.64.0.1", "100.100.100.100", "100.127.255.254"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("le reste d'Internet est public, et 172.32/16 n'est pas 172.16/12", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "2a01:e0a::1", "203.0.113.5"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("getRealClientIp", () => {
  const req = (remote: string, headers: Record<string, string> = {}) => ({ ip: remote, headers, socket: { remoteAddress: remote } });

  it("CF-Connecting-IP, puis X-Real-IP, seulement derrière un mandataire voisin", () => {
    expect(getRealClientIp(req("172.20.0.4", { "cf-connecting-ip": "203.0.113.7", "x-real-ip": "198.51.100.2" }))).toBe("203.0.113.7");
    expect(getRealClientIp(req("172.20.0.4", { "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("un client d'Internet ne choisit pas son adresse", () => {
    expect(getRealClientIp(req("203.0.113.9", { "cf-connecting-ip": "192.168.1.20", "x-real-ip": "10.0.0.1" }))).toBe("203.0.113.9");
  });
});
