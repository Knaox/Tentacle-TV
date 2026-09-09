/**
 * Mio/s saisis ↔ octets par seconde stockés : la virgule passe, l'illimité
 * est `null`, l'invalide est `undefined`, et un aller-retour ne déforme rien.
 */

import { describe, expect, it } from "vitest";
import { MIB, toBps, toDraft } from "./adminBandwidthUnits";

describe("adminBandwidthUnits", () => {
  it("illimité se dessine éteint et vide, un plafond allumé avec sa valeur", () => {
    expect(toDraft(null)).toEqual({ enabled: false, mib: "" });
    expect(toDraft(6 * MIB)).toEqual({ enabled: true, mib: "6" });
    expect(toDraft(6.5 * MIB)).toEqual({ enabled: true, mib: "6.5" });
    expect(toDraft(104_857)).toEqual({ enabled: true, mib: "0.1" });
  });

  it("éteint = illimité, quel que soit le texte", () => {
    expect(toBps({ enabled: false, mib: "abc" })).toBeNull();
  });

  it("accepte le point comme la virgule, et arrondit à l'octet", () => {
    expect(toBps({ enabled: true, mib: "6" })).toBe(6 * MIB);
    expect(toBps({ enabled: true, mib: " 6,5 " })).toBe(Math.round(6.5 * MIB));
    expect(toBps({ enabled: true, mib: "0.1" })).toBe(Math.round(0.1 * MIB));
  });

  it("refuse le vide, le texte et les valeurs hors bornes", () => {
    for (const mib of ["", "abc", "0", "0.05", "-3", "10241", "1e9"]) {
      expect(toBps({ enabled: true, mib }), mib).toBeUndefined();
    }
  });

  it("un aller-retour rend la valeur d'origine", () => {
    for (const bps of [6 * MIB, Math.round(2.5 * MIB), 10_240 * MIB]) {
      expect(toBps(toDraft(bps))).toBe(bps);
    }
  });
});
