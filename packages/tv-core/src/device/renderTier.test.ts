import { describe, expect, it } from "vitest";
import { RENDER_TIER_THRESHOLDS, decideAutoTier, parseRenderTierMode, resolveRenderTier, type BenchResult, type DeviceSignals, type TierReason } from "./renderTier";
import { SIMULATED_DEVICES } from "./signalOverride";

const V = RENDER_TIER_THRESHOLDS.benchVersion;
const fast: BenchResult = { score: 2400, version: V };
const slow: BenchResult = { score: 400, version: V };
const a53 = (n: number) => Array.from({ length: n }, () => "0x41:0xd03");
const a73 = (n: number) => Array.from({ length: n }, () => "0x41:0xd09");

/**
 * LE TABLEAU DES CAS — chaque ligne tranche un appareil et dit pourquoi.
 * Les trois appareils de la fiche d'abord, puis les cas limites.
 */
const CASES: Array<{ name: string; signals: DeviceSignals; bench?: BenchResult | null; tier: "normal" | "lite"; reason: TierReason; why: string }> = [
  { name: "Shield TV Pro (3 Go, 4 × A57)", signals: SIMULATED_DEVICES.shield, tier: "normal", reason: "capable", why: "la référence de la refonte" },
  { name: "Shield TV Pro, micro-test rapide", signals: SIMULATED_DEVICES.shield, bench: fast, tier: "normal", reason: "capable", why: "le micro-test confirme" },
  { name: "box net+ (BCM7271, 2 Go, 4 × B53)", signals: SIMULATED_DEVICES.netplus, tier: "lite", reason: "lowRam", why: "2 Go : la mémoire passe avant les cœurs" },
  { name: "Android TV à 1 Go", signals: SIMULATED_DEVICES["1gb"], tier: "lite", reason: "lowRamDevice", why: "le fabricant la déclare à mémoire limitée" },
  { name: "appareil inconnu (rien de lu)", signals: {}, tier: "normal", reason: "unknown", why: "une lecture ratée ne fait régresser personne ; le micro-test est le filet" },
  { name: "inconnu, micro-test lent", signals: {}, bench: slow, tier: "lite", reason: "slowBench", why: "le filet a joué (au lancement suivant)" },
  { name: "inconnu, micro-test rapide", signals: {}, bench: fast, tier: "normal", reason: "capable", why: "mesuré capable" },
  // Les cas limites.
  { name: "puissant à 2 Go (4 × A73, 1,9 Gio)", signals: { totalRamMb: 1950, coreCount: 4, coreIds: a73(4) }, bench: fast, tier: "lite", reason: "lowRam", why: "la mémoire est la limite dure (tueur de processus) ; un bon processeur n'y change rien — « Désactivé » reste offert" },
  { name: "3 Go nominal vu à 2,6 Gio", signals: { totalRamMb: 2600, coreCount: 4, coreIds: a73(4) }, tier: "normal", reason: "capable", why: "au-dessus de la coupure de 2,5 Gio" },
  { name: "2 Go nominal vu à 2 048 Mio pile", signals: { totalRamMb: 2048 }, tier: "lite", reason: "lowRam", why: "sous la coupure" },
  { name: "low RAM déclaré mais 4 Go", signals: { lowRamDevice: true, totalRamMb: 3900 }, tier: "lite", reason: "lowRamDevice", why: "signaux contradictoires : la déclaration du fabricant l'emporte" },
  { name: "4 Go mais 4 × A53", signals: { totalRamMb: 3900, coreCount: 4, coreIds: a53(4) }, tier: "lite", reason: "weakCores", why: "tous les cœurs faibles" },
  { name: "4 Go, 4 × A55 (S905X4)", signals: { totalRamMb: 3900, coreCount: 4, coreIds: Array.from({ length: 4 }, () => "0x41:0xd05") }, tier: "lite", reason: "weakCores", why: "l'A55 reste un petit cœur" },
  { name: "big.LITTLE complet (4 × A53 + 4 × A73)", signals: { totalRamMb: 3900, coreCount: 8, coreIds: [...a53(4), ...a73(4)] }, tier: "normal", reason: "capable", why: "un cœur capable suffit" },
  { name: "big.LITTLE, grands cœurs éteints à la lecture", signals: { totalRamMb: 3900, coreCount: 8, coreIds: a53(4) }, tier: "normal", reason: "capable", why: "faux positif évité : 4 cœurs lus sur 8, on ne conclut pas" },
  { name: "cœurs inconnus (émulateur)", signals: { totalRamMb: 3900, coreCount: 4, coreIds: Array.from({ length: 4 }, () => "0x61:0x000") }, tier: "normal", reason: "capable", why: "un cœur non reconnu n'est jamais dit faible" },
  { name: "signaux forts, micro-test lent", signals: { totalRamMb: 3900, coreCount: 4, coreIds: a73(4) }, bench: slow, tier: "lite", reason: "slowBench", why: "faux négatif rattrapé (cpuinfo trompeur, bridage thermique)" },
  { name: "signaux faibles, micro-test rapide", signals: SIMULATED_DEVICES.netplus, bench: fast, tier: "lite", reason: "lowRam", why: "jamais l'inverse : le micro-test ne sort pas de Lite" },
  { name: "micro-test d'une autre version", signals: { totalRamMb: 3900 }, bench: { score: 10, version: V + 1 }, tier: "normal", reason: "capable", why: "un autre barème : ignoré, il sera refait" },
  { name: "micro-test absurde (0)", signals: { totalRamMb: 3900 }, bench: { score: 0, version: V }, tier: "normal", reason: "capable", why: "un score nul est une mesure ratée" },
];

describe("le niveau de rendu automatique — le tableau des cas", () => {
  for (const c of CASES) {
    it(`${c.name} → ${c.tier} (${c.reason}) : ${c.why}`, () => {
      const verdict = decideAutoTier(c.signals, c.bench);
      expect(verdict.tier).toBe(c.tier);
      expect(verdict.reason).toBe(c.reason);
    });
  }

  it("dit le détail de sa raison : la mémoire lue, les cœurs, le score", () => {
    expect(decideAutoTier(SIMULATED_DEVICES.netplus).detail).toBe("1890 Mio");
    expect(decideAutoTier({ totalRamMb: 3900, coreCount: 4, coreIds: a53(4) }).detail).toBe("4 × Cortex-A53");
    expect(decideAutoTier({ totalRamMb: 3900 }, slow).detail).toBe(`400 < ${RENDER_TIER_THRESHOLDS.liteBenchBelow}`);
  });
});

describe("le niveau en vigueur", () => {
  it("l'Apple TV vaut TOUJOURS normal, quoi qu'on lui donne", () => {
    for (const forced of [null, "lite" as const]) {
      for (const mode of ["auto", "on", "off"] as const) {
        const state = resolveRenderTier({ platform: "tvos", mode, forced, signals: SIMULATED_DEVICES["1gb"], bench: slow });
        expect(state).toEqual({ tier: "normal", reason: "platform", mode: "auto", auto: { tier: "normal", reason: "platform" } });
      }
    }
  });

  it("le réglage de l'utilisateur l'emporte sur l'automatique, qui reste dit (la raison détectée)", () => {
    const on = resolveRenderTier({ platform: "androidtv", mode: "on", signals: SIMULATED_DEVICES.shield });
    expect(on).toMatchObject({ tier: "lite", reason: "userOn", mode: "on", auto: { tier: "normal", reason: "capable" } });
    const off = resolveRenderTier({ platform: "androidtv", mode: "off", signals: SIMULATED_DEVICES.netplus });
    expect(off).toMatchObject({ tier: "normal", reason: "userOff", auto: { tier: "lite", reason: "lowRam" } });
  });

  it("automatique : le verdict des signaux", () => {
    expect(resolveRenderTier({ platform: "androidtv", signals: SIMULATED_DEVICES.netplus })).toMatchObject({ tier: "lite", reason: "lowRam", mode: "auto" });
  });

  it("le forçage de débogage passe avant le réglage", () => {
    expect(resolveRenderTier({ platform: "androidtv", mode: "off", forced: "lite", signals: {} })).toMatchObject({ tier: "lite", reason: "debugForced", mode: "off" });
    expect(resolveRenderTier({ platform: "androidtv", mode: "on", forced: "normal", signals: {} })).toMatchObject({ tier: "normal", reason: "debugForced" });
  });

  it("un réglage illisible vaut « Automatique »", () => {
    expect(parseRenderTierMode("on")).toBe("on");
    expect(parseRenderTierMode("off")).toBe("off");
    for (const raw of ["auto", "", null, undefined, 1, "ON"]) expect(parseRenderTierMode(raw)).toBe("auto");
  });
});
