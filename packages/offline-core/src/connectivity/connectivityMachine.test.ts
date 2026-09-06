import { describe, expect, it } from "vitest";
import {
  applyProbeResult,
  deriveLinkQuality,
  deriveState,
  initialHysteresis,
  LATENCY_HYSTERESIS,
  SLOW_LINK_MS,
  type HysteresisConfig,
  type HysteresisState,
} from "./connectivityMachine";

const CFG: HysteresisConfig = { flipThreshold: 2, dwellMs: 10_000 };

const online = (at = 0): HysteresisState => ({ reachable: true, streak: 0, lastFlipAt: at });
const offline = (at = 0): HysteresisState => ({ reachable: false, streak: 0, lastFlipAt: at });

describe("applyProbeResult", () => {
  it("fixe la joignabilité au premier résultat, sans hystérésis", () => {
    const up = applyProbeResult(initialHysteresis, true, 1_000, CFG);
    expect(up.flipped).toBe(true);
    expect(up.next.reachable).toBe(true);

    const down = applyProbeResult(initialHysteresis, false, 1_000, CFG);
    expect(down.flipped).toBe(true);
    expect(down.next.reachable).toBe(false);
  });

  it("ne bascule pas sur un seul échec et demande une confirmation", () => {
    const r = applyProbeResult(online(0), false, 20_000, CFG);
    expect(r.flipped).toBe(false);
    expect(r.wantConfirm).toBe(true);
    expect(r.next.reachable).toBe(true);
    expect(r.next.streak).toBe(1);
  });

  it("bascule hors ligne après deux échecs consécutifs (dwell écoulé)", () => {
    const first = applyProbeResult(online(0), false, 20_000, CFG);
    const second = applyProbeResult(first.next, false, 23_000, CFG);
    expect(second.flipped).toBe(true);
    expect(second.next.reachable).toBe(false);
    expect(second.next.streak).toBe(0);
  });

  it("un succès intercalé remet le compteur à zéro", () => {
    const first = applyProbeResult(online(0), false, 20_000, CFG);
    const recover = applyProbeResult(first.next, true, 21_000, CFG);
    expect(recover.flipped).toBe(false);
    expect(recover.next.streak).toBe(0);
    const failAgain = applyProbeResult(recover.next, false, 22_000, CFG);
    expect(failAgain.flipped).toBe(false);
    expect(failAgain.next.streak).toBe(1);
  });

  it("le temps de séjour minimal bloque la bascule puis l'autorise", () => {
    const justFlipped = offline(100_000);
    const s1 = applyProbeResult(justFlipped, true, 101_000, CFG);
    const s2 = applyProbeResult(s1.next, true, 104_000, CFG);
    expect(s2.flipped).toBe(false);
    expect(s2.wantConfirm).toBe(true);

    const s3 = applyProbeResult(s2.next, true, 111_000, CFG);
    expect(s3.flipped).toBe(true);
    expect(s3.next.reachable).toBe(true);
  });

  it("la bascule vers hors ligne ignore le temps de séjour (asymétrie)", () => {
    // Bascule en ligne toute récente (dwell non écoulé) : la panne doit quand
    // même l'emporter dès le seuil de 2 échecs.
    const s1 = applyProbeResult(online(100_000), false, 101_000, CFG);
    expect(s1.flipped).toBe(false); // le seuil, lui, reste exigé
    expect(s1.wantConfirm).toBe(true);
    const s2 = applyProbeResult(s1.next, false, 104_000, CFG);
    expect(s2.flipped).toBe(true);
    expect(s2.next.reachable).toBe(false);
  });

  it("le retour en ligne exige aussi le seuil de succès consécutifs", () => {
    const s1 = applyProbeResult(offline(0), true, 20_000, CFG);
    expect(s1.flipped).toBe(false);
    const s2 = applyProbeResult(s1.next, true, 23_000, CFG);
    expect(s2.flipped).toBe(true);
    expect(s2.next.reachable).toBe(true);
  });
});

describe("deriveState", () => {
  it("mappe mode + joignabilité vers l'état affiché, le manuel gagnant", () => {
    expect(deriveState(false, null)).toBe("checking");
    expect(deriveState(false, true)).toBe("online");
    expect(deriveState(false, false)).toBe("offline-auto");
    expect(deriveState(true, true)).toBe("offline-manual");
    expect(deriveState(true, false)).toBe("offline-manual");
    expect(deriveState(true, null)).toBe("offline-manual");
  });
});

describe("deriveLinkQuality", () => {
  it("reste optimiste tant que rien n'a été mesuré", () => {
    expect(deriveLinkQuality(null)).toBe("fast");
  });

  it("mappe la mesure confirmée", () => {
    expect(deriveLinkQuality(true)).toBe("fast");
    expect(deriveLinkQuality(false)).toBe("slow");
  });
});

describe("hystérésis de la latence", () => {
  // `reachable` porte ici « dernière mesure RAPIDE confirmée ».
  const fast = (at = 0): HysteresisState => ({ reachable: true, streak: 0, lastFlipAt: at });
  const measure = (state: HysteresisState, latencyMs: number, now: number) =>
    applyProbeResult(state, latencyMs < SLOW_LINK_MS, now, LATENCY_HYSTERESIS);

  it("tranche dès la première mesure — un boot sur lien pourri doit économiser tout de suite", () => {
    const slow = measure(initialHysteresis, 3_000, 1_000);
    expect(slow.flipped).toBe(true);
    expect(deriveLinkQuality(slow.next.reachable)).toBe("slow");
  });

  it("ne dégrade pas sur un pic isolé", () => {
    const spike = measure(fast(0), 4_000, 300_000);
    expect(spike.flipped).toBe(false);
    expect(deriveLinkQuality(spike.next.reachable)).toBe("fast");
  });

  it("bascule en lent après deux mesures lentes consécutives", () => {
    const first = measure(fast(0), 4_000, 300_000);
    const second = measure(first.next, 2_500, 600_000);
    expect(second.flipped).toBe(true);
    expect(deriveLinkQuality(second.next.reachable)).toBe("slow");
  });

  it("une mesure rapide intercalée annule la dégradation en cours", () => {
    const first = measure(fast(0), 4_000, 300_000);
    const recovered = measure(first.next, 80, 600_000);
    expect(recovered.next.streak).toBe(0);
    const slowAgain = measure(recovered.next, 4_000, 900_000);
    expect(slowAgain.flipped).toBe(false);
  });

  it("remonte en rapide après deux mesures rapides — pas de temps de séjour", () => {
    const slow: HysteresisState = { reachable: false, streak: 0, lastFlipAt: 300_000 };
    const s1 = measure(slow, 80, 300_100);
    expect(s1.flipped).toBe(false);
    const s2 = measure(s1.next, 120, 300_200);
    expect(s2.flipped).toBe(true);
    expect(deriveLinkQuality(s2.next.reachable)).toBe("fast");
  });

  it("le seuil sépare bien rapide et lent", () => {
    expect(measure(initialHysteresis, SLOW_LINK_MS - 1, 0).next.reachable).toBe(true);
    expect(measure(initialHysteresis, SLOW_LINK_MS, 0).next.reachable).toBe(false);
  });
});
