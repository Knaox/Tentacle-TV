import { describe, expect, it } from "vitest";
import { isPrivateIp } from "../../../services/networkUtils";
import { DEVICE_EGRESS_LIMITS, EgressBudget, egressOf, SERVER_EGRESS } from "./egressBudget";

/** Plusieurs appareils derrière la même adresse partagent UN plafond YouTube, les gestes d'abord. */

const T0 = 1_793_000_000_000;

describe("adresse de sortie d'un appareil", () => {
  it("une adresse privée sort par la box du serveur ; l'adresse publique connue du serveur aussi", () => {
    expect(egressOf("192.168.1.20", [], isPrivateIp)).toBe(SERVER_EGRESS);
    expect(egressOf("::ffff:10.0.0.7", [], isPrivateIp)).toBe(SERVER_EGRESS);
    expect(egressOf("fd12::5", [], isPrivateIp)).toBe(SERVER_EGRESS);
    expect(egressOf("203.0.113.9", ["203.0.113.9"], isPrivateIp)).toBe(SERVER_EGRESS);
  });

  it("une adresse publique telle quelle ; en IPv6, son /64 (un réseau de box entier)", () => {
    expect(egressOf("203.0.113.9", [], isPrivateIp)).toBe("v4:203.0.113.9");
    expect(egressOf("::ffff:203.0.113.9", [], isPrivateIp)).toBe("v4:203.0.113.9");
    expect(egressOf("2a01:cb00:12:3400:1111:2222:3333:4444", [], isPrivateIp)).toBe("v6:2a01:cb00:12:3400::/64");
    expect(egressOf("2a01:cb00:12:3400::9", [], isPrivateIp)).toBe("v6:2a01:cb00:12:3400::/64");
    expect(egressOf("2a01:cb00:12:3400::9", ["2a01:cb00:12:3400::1"], isPrivateIp)).toBe(SERVER_EGRESS);
  });
});

describe("budget par adresse", () => {
  it("trois téléphones derrière la même box : 150 dans l'heure À EUX TROIS, pas 450", () => {
    const budget = new EgressBudget({ ...DEVICE_EGRESS_LIMITS, spacingMs: 0 });
    let granted = 0;
    // 150 gestes étalés sur 59 min (sous 20/min), de trois appareils de la même adresse.
    for (let i = 0; i < 160; i++) if (budget.admit("v4:203.0.113.9", "play", T0 + i * 22_000).granted) granted++;
    expect(granted).toBe(150);
    // Une autre adresse n'en souffre pas.
    expect(budget.admit("v4:198.51.100.1", "play", T0 + 160 * 22_000).granted).toBe(true);
  });

  it("20 par minute, dont 12 au plus pour le fond : la minute garde 8 places aux gestes", () => {
    const budget = new EgressBudget({ ...DEVICE_EGRESS_LIMITS, spacingMs: 0 });
    const key = "v4:203.0.113.9";
    for (let i = 0; i < 12; i++) expect(budget.admit(key, "prefetch", T0 + i).granted).toBe(true);
    const refused = budget.admit(key, "prefetch", T0 + 12);
    expect(refused.granted).toBe(false);
    if (!refused.granted) expect(refused.retryAfterMs).toBeGreaterThan(59_000);
    for (let i = 0; i < 8; i++) expect(budget.admit(key, "play", T0 + 20 + i).granted).toBe(true);
    expect(budget.admit(key, "play", T0 + 30).granted).toBe(false);
    expect(budget.admit(key, "play", T0 + 60_001).granted).toBe(true);
  });

  it("le fond s'arrête à 110 dans l'heure, les gestes vont jusqu'à 150", () => {
    const budget = new EgressBudget({ ...DEVICE_EGRESS_LIMITS, spacingMs: 0, perMinute: 1_000, prefetchPerMinute: 1_000 });
    const key = "v4:203.0.113.9";
    for (let i = 0; i < 110; i++) expect(budget.admit(key, "prefetch", T0 + i).granted).toBe(true);
    expect(budget.admit(key, "prefetch", T0 + 200).granted).toBe(false);
    for (let i = 0; i < 40; i++) expect(budget.admit(key, "play", T0 + 300 + i).granted).toBe(true);
    expect(budget.admit(key, "play", T0 + 400).granted).toBe(false);
    expect(budget.usedInHour(key, T0 + 400)).toBe(150);
  });

  it("une cadence entre deux places d'une même adresse ; les adresses suivies sont bornées", () => {
    const budget = new EgressBudget({ ...DEVICE_EGRESS_LIMITS, maxAddresses: 2 });
    expect(budget.admit("v4:1.1.1.1", "play", T0)).toEqual({ granted: true, waitMs: 0 });
    expect(budget.admit("v4:1.1.1.1", "play", T0)).toEqual({ granted: true, waitMs: 250 });
    budget.admit("v4:2.2.2.2", "play", T0);
    budget.admit("v4:3.3.3.3", "play", T0);
    expect(budget.usedInHour("v4:1.1.1.1", T0)).toBe(0);
  });
});
