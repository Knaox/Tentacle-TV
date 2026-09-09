/**
 * Le pool d'une adresse : privée → réseau local ; extérieure → extérieur, sauf
 * si l'admin l'a ajoutée à la liste — adresse exacte, IPv6 comprise, ou plage
 * IPv4.
 */

import { describe, expect, it } from "vitest";
import { isAllowlisted, isValidIpOrCidr, normalizeEntry, poolFor } from "./pool";

describe("isValidIpOrCidr", () => {
  it("accepte IPv4, IPv6 et une plage IPv4", () => {
    for (const ok of ["203.0.113.5", "2001:db8::1", "203.0.113.0/24", "10.0.0.0/8", "0.0.0.0/0"]) {
      expect(isValidIpOrCidr(ok), ok).toBe(true);
    }
  });

  it("refuse le reste", () => {
    for (const bad of ["", "203.0.113", "203.0.113.256", "203.0.113.0/33", "2001:db8::/64", "maison", "203.0.113.5 "]) {
      expect(isValidIpOrCidr(bad), bad).toBe(false);
    }
  });
});

describe("isAllowlisted", () => {
  const list = ["203.0.113.5", "198.51.100.0/24", "2001:DB8::1"];

  it("adresse exacte, plage IPv4, IPv6 sans tenir compte de la casse", () => {
    expect(isAllowlisted("203.0.113.5", list)).toBe(true);
    expect(isAllowlisted("198.51.100.77", list)).toBe(true);
    expect(isAllowlisted("2001:db8::1", list)).toBe(true);
  });

  it("une IPv4 vue par une socket IPv6 est démappée", () => {
    expect(isAllowlisted("::ffff:203.0.113.5", list)).toBe(true);
    expect(normalizeEntry("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("hors liste : non", () => {
    expect(isAllowlisted("203.0.113.6", list)).toBe(false);
    expect(isAllowlisted("198.51.101.1", list)).toBe(false);
    expect(isAllowlisted("2001:db8::2", list)).toBe(false);
    expect(isAllowlisted("203.0.113.5", [])).toBe(false);
  });
});

describe("poolFor", () => {
  it("privée → local, extérieure → extérieur, listée → local", () => {
    expect(poolFor("192.168.1.10", [])).toBe("internal");
    expect(poolFor("203.0.113.5", [])).toBe("external");
    expect(poolFor("203.0.113.5", ["203.0.113.0/24"])).toBe("internal");
  });
});
