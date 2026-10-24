import { describe, expect, it } from "vitest";
import { HOST_YOUTUBE_LIMITS, HostYouTubeLedger, type SharedBreaker } from "./hostYouTubeLedger";

/** Un disjoncteur factice : ouvert jusqu'à `until`, mémorise ses ouvertures et fermetures. */
function breaker() {
  const state = { until: 0, trippedAt: null as number | null, trips: 0, successes: 0 };
  const b: SharedBreaker = {
    remainingMs: (now) => Math.max(0, state.until - now),
    trip: (_r, now) => {
      if (state.until > now) return;
      state.until = now + 30 * 60_000;
      state.trippedAt = now;
      state.trips++;
    },
    recordSuccess: () => {
      state.until = 0;
      state.successes++;
    },
    lastTripAt: () => state.trippedAt,
  };
  return { b, state };
}

/** Des places accordées en série : on avance l'horloge de l'attente de cadence à chaque fois. */
function admitMany(ledger: HostYouTubeLedger, n: number, kind: "play" | "prefetch", start: number, id = "sillon") {
  let t = start;
  let granted = 0;
  for (let i = 0; i < n; i++) {
    const r = ledger.admitExtension(id, kind, 1, t);
    if (!r.granted) return { granted, refusal: r, t };
    granted++;
    t += r.waitMs + 3_100; // au-delà de la minute de 20
  }
  return { granted, refusal: null, t };
}

describe("budget YouTube de l'hôte", () => {
  it("les bandes-annonces ne sont jamais refusées tant que l'heure n'est pas pleine", () => {
    const ledger = new HostYouTubeLedger(breaker().b);
    for (let i = 0; i < 149; i++) {
      expect(ledger.trailerRefusal(i * 1_000)).toBeNull();
      ledger.countTrailer(i * 1_000);
    }
    expect(ledger.trailerRefusal(150_000)).toBeNull();
    ledger.countTrailer(150_000);
    // 150 dans l'heure : la suivante attend que la plus ancienne sorte (t = 0 + 1 h).
    expect(ledger.trailerRefusal(151_000)).toBe(3_600_000 - 151_000);
  });

  it("extensions : l'anticipation s'arrête à 110, la lecture à 140, et il reste toujours 40 aux bandes-annonces", () => {
    const ledger = new HostYouTubeLedger(breaker().b);
    // 100 bandes-annonces étalées sur 33 min (jamais plus de 3 par minute).
    for (let i = 0; i < 100; i++) ledger.countTrailer(i * 20_000);
    const prefetch = admitMany(ledger, 50, "prefetch", 2_000_000, "a");
    expect(prefetch.granted).toBe(10);
    expect(prefetch.refusal?.reason).toBe("budget");
    const play = admitMany(ledger, 50, "play", prefetch.t, "a");
    expect(play.granted).toBe(30);
    expect(ledger.trailerRefusal(play.t)).toBeNull();
  });

  it("100 par heure au plus pour une extension, et 20 par minute tout compris", () => {
    const ledger = new HostYouTubeLedger(breaker().b);
    expect(admitMany(ledger, 120, "play", 0).granted).toBe(HOST_YOUTUBE_LIMITS.perExtensionHour);
    const other = new HostYouTubeLedger(breaker().b);
    let t = 0;
    let granted = 0;
    for (let i = 0; i < 30; i++) {
      const r = other.admitExtension("sillon", "play", 1, t);
      if (r.granted) granted++;
      else expect(r.reason).toBe("budget");
    }
    expect(granted).toBe(HOST_YOUTUBE_LIMITS.perMinute);
    t += 60_001 + 20 * HOST_YOUTUBE_LIMITS.extensionSpacingMs;
    expect(other.admitExtension("sillon", "play", 1, t).granted).toBe(true);
  });

  it("cadence : deux places d'extension à 250 ms d'écart au moins ; un coût de 3 en réserve trois", () => {
    const ledger = new HostYouTubeLedger(breaker().b);
    expect(ledger.admitExtension("s", "play", 3, 0)).toEqual({ granted: true, waitMs: 0 });
    expect(ledger.admitExtension("s", "play", 1, 0)).toEqual({ granted: true, waitMs: 750 });
    expect(ledger.usedInHour(0)).toBe(4);
  });

  it("disjoncteur commun : un anti-robot d'extension l'ouvre ; une sonde de lecture toutes les 5 min la referme", () => {
    const { b, state } = breaker();
    const ledger = new HostYouTubeLedger(b);
    ledger.report("antiBot", 0, 1_000);
    expect(state.trips).toBe(1);
    expect(ledger.admitExtension("s", "prefetch", 1, 2_000)).toMatchObject({ granted: false, reason: "blocked" });
    const probe = ledger.admitExtension("s", "play", 1, 2_000);
    expect(probe.granted).toBe(true);
    expect(ledger.admitExtension("s", "play", 1, 3_000)).toMatchObject({ granted: false, reason: "blocked" });
    // Une réponse partie AVANT l'ouverture ne referme rien ; la sonde, partie après, si.
    ledger.report("ok", 500, 4_000);
    expect(state.successes).toBe(0);
    ledger.report("ok", 2_000, 4_000);
    expect(state.successes).toBe(1);
  });

  it("l'état se photographie et se reprend (au redémarrage, rien ne repart de zéro)", () => {
    const ledger = new HostYouTubeLedger(breaker().b);
    ledger.countTrailer(10);
    ledger.admitExtension("sillon", "play", 2, 20);
    const again = new HostYouTubeLedger(breaker().b);
    again.restore(ledger.snapshot(1_000), 1_000);
    expect(again.usedInHour(1_000)).toBe(3);
  });
});
