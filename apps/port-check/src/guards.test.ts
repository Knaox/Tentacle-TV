import { describe, expect, it } from "vitest";
import { ChallengeLedger, isPublicAddress, RateLimiter, rateKey } from "./guards";

describe("isPublicAddress", () => {
  it("refuse les réseaux privés, partagés, de documentation et réservés", () => {
    for (const ip of ["10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.20.0.1", "192.168.1.1", "203.0.113.5", "::1", "fd00::1", "fe80::1", "2001:db8::1", "0.0.0.0"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ["8.8.8.8", "185.1.2.3", "2a01:e0a:1::5", "2606:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});

describe("rateKey", () => {
  it("l'adresse en IPv4, le /64 en IPv6", () => {
    expect(rateKey("185.1.2.3")).toBe("185.1.2.3");
    expect(rateKey("2a01:e0a:1:2:aaaa:bbbb:cccc:dddd")).toBe("2a01:e0a:1:2::/64");
    expect(rateKey("2a01:e0a::5")).toBe("2a01:e0a:0:0::/64");
    expect(rateKey("2a01:e0a:1:2::5")).toBe(rateKey("2a01:e0a:1:2:ffff::9"));
  });
});

describe("RateLimiter", () => {
  it("six par fenêtre, puis la fenêtre suivante repart", () => {
    const limiter = new RateLimiter(6, 1_000);
    for (let i = 0; i < 6; i++) expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 10)).toBe(false);
    expect(limiter.take("b", 10)).toBe(true);
    expect(limiter.take("a", 1_000)).toBe(true);
  });
});

describe("ChallengeLedger", () => {
  it("un défi ne sert qu'une fois dans sa fenêtre", () => {
    const ledger = new ChallengeLedger(1_000, 3);
    expect(ledger.claim("x", 0)).toBe(true);
    expect(ledger.claim("x", 500)).toBe(false);
    expect(ledger.claim("x", 1_000)).toBe(true);
  });

  it("reste borné en mémoire", () => {
    const ledger = new ChallengeLedger(10_000, 3);
    for (const id of ["a", "b", "c", "d"]) expect(ledger.claim(id, 0)).toBe(true);
    // « a », le plus ancien, a cédé sa place.
    expect(ledger.claim("a", 1)).toBe(true);
  });
});
