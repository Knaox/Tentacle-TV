import { describe, expect, it } from "vitest";
import { allCoresWeak, describeCores, normalizeCoreId } from "./cpuCores";
import { RENDER_TIER_THRESHOLDS } from "./renderTier";
import { SIMULATED_DEVICES, applySignalOverride, parseForcedTier, parseSignalOverride } from "./signalOverride";

describe("les cœurs", () => {
  it("normalise l'identité lue, en hexadécimal ou en décimal", () => {
    expect(normalizeCoreId("0x41:0xd03")).toBe("0x41:0xd03");
    expect(normalizeCoreId("0X42:0X100")).toBe("0x42:0x100");
    expect(normalizeCoreId("65:3331")).toBe("0x41:0xd03");
    expect(normalizeCoreId("0x41")).toBeNull();
    expect(normalizeCoreId("zz:0xd03")).toBeNull();
  });

  it("ne dit « tous faibles » que s'il les connaît TOUS", () => {
    expect(allCoresWeak(["0x42:0x100", "0x42:0x100"], 2)).toBe(true);
    expect(allCoresWeak(["0x41:0xd03", "0x41:0xd07"], 2)).toBe(false);
    expect(allCoresWeak(["0x41:0xd03"], 4)).toBe(false);
    expect(allCoresWeak([], 4)).toBe(false);
    expect(allCoresWeak(undefined, undefined)).toBe(false);
  });

  it("les nomme pour les journaux", () => {
    expect(describeCores(["0x41:0xd03", "0x41:0xd03", "0x41:0xd09"])).toBe("2 × Cortex-A53 + 1 × Cortex-A73");
    expect(describeCores(["0x61:0x022"])).toBe("1 × 0x61:0x022");
  });
});

describe("la simulation des signaux (propriétés de débogage)", () => {
  it("lit le forçage du niveau", () => {
    for (const raw of ["1", "on", "lite", " LITE "]) expect(parseForcedTier(raw)).toBe("lite");
    for (const raw of ["0", "off", "normal"]) expect(parseForcedTier(raw)).toBe("normal");
    for (const raw of ["", "2", null, undefined, "auto"]) expect(parseForcedTier(raw)).toBeNull();
  });

  it("un profil nommé remplace tous les signaux", () => {
    const override = parseSignalOverride("netplus");
    expect(override).toEqual({ replace: true, signals: SIMULATED_DEVICES.netplus });
    expect(applySignalOverride({ totalRamMb: 16000, soc: "réel" }, override)).toEqual(SIMULATED_DEVICES.netplus);
  });

  it("« unknown » oublie tout", () => {
    expect(applySignalOverride({ totalRamMb: 16000 }, parseSignalOverride("unknown"))).toEqual({});
  });

  it("des clé=valeur corrigent les signaux réels, ou un profil", () => {
    const override = parseSignalOverride("ram=1900, lowram=1, cores=4, parts=0x41:0xd03*4, freq=1600, soc=BCM7271, sdk=28, res=1920x1080, memclass=192");
    expect(applySignalOverride({ totalRamMb: 16000, maxFreqMhz: 3000 }, override)).toEqual({
      lowRamDevice: true, totalRamMb: 1900, memoryClassMb: 192, coreCount: 4, maxFreqMhz: 1600,
      coreIds: ["0x41:0xd03", "0x41:0xd03", "0x41:0xd03", "0x41:0xd03"], soc: "BCM7271", sdkInt: 28,
      display: { width: 1920, height: 1080 },
    });
    expect(applySignalOverride({}, parseSignalOverride("shield,ram=1900"))).toMatchObject({ totalRamMb: 1900, coreCount: 4 });
  });

  it("des cœurs mêlés : `;` les sépare", () => {
    expect(parseSignalOverride("parts=0x41:0xd03*2;0x41:0xd09")?.signals.coreIds).toEqual(["0x41:0xd03", "0x41:0xd03", "0x41:0xd09"]);
  });

  it("injecte un score de micro-test, à la version courante", () => {
    expect(parseSignalOverride("bench=0.5")).toEqual({ replace: false, signals: {}, bench: { score: 0.5, version: RENDER_TIER_THRESHOLDS.benchVersion } });
  });

  it("ignore le vide, l'inconnu et l'illisible", () => {
    for (const raw of ["", "  ", null, undefined, "pomme", "ram=", "foo=1"]) {
      const override = parseSignalOverride(raw);
      expect(applySignalOverride({ totalRamMb: 3000 }, override)).toEqual({ totalRamMb: 3000 });
    }
  });

  it("chaque profil tient dans une propriété système (91 caractères) — et les clé=valeur d'un essai typique aussi", () => {
    expect("ram=1900,lowram=0,cores=4,parts=0x42:0x100*4,freq=1600,soc=BCM7271,bench=0.5".length).toBeLessThanOrEqual(91);
  });
});
