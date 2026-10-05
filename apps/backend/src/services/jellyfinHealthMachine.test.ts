import { describe, expect, it } from "vitest";
import type { JellyfinHealthState } from "./deviceSessions/protocolMessages";
import {
  ANNOUNCED_GRACE_MS,
  JellyfinHealthMachine,
  PROBE_FAST_MS,
  PROBE_INTERVAL_MS,
  RESTART_PATIENCE_MS,
  type ProbeVerdict,
} from "./jellyfinHealthMachine";

/**
 * La machine d'états de la santé de Jellyfin, sur une horloge simulée : la
 * sonde répond ce que le scénario lui dicte, chaque appel est compté. Les
 * scénarios rejouent les séquences MESURÉES sur Jellyfin 10.11.11.
 */

function harness() {
  let now = 1_000_000;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let nextId = 1;
  const answers: ProbeVerdict[] = [];
  let fallback: ProbeVerdict = "ok";
  const probes: number[] = [];
  const machine = new JellyfinHealthMachine({
    probe: () => {
      probes.push(now);
      return Promise.resolve(answers.shift() ?? fallback);
    },
    clock: {
      now: () => now,
      setTimeout: (fn, ms) => {
        const id = nextId++;
        timers.push({ at: now + ms, fn, id });
        return id;
      },
      clearTimeout: (id) => {
        const index = timers.findIndex((t) => t.id === id);
        if (index >= 0) timers.splice(index, 1);
      },
    },
  });
  const states: Array<{ state: JellyfinHealthState; at: number }> = [];
  machine.subscribe((next) => states.push({ state: next.state, at: now }));
  /** Avance l'horloge en déclenchant les minuteries échues, promesses comprises. */
  async function advance(ms: number): Promise<void> {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const due = timers[0];
      if (!due || due.at > end) break;
      timers.shift();
      now = due.at;
      due.fn();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }
    now = end;
  }
  return {
    machine,
    states,
    probes,
    advance,
    answer: (...verdicts: ProbeVerdict[]) => answers.push(...verdicts),
    otherwise: (verdict: ProbeVerdict) => { fallback = verdict; },
    now: () => now,
    pendingTimers: () => timers.length,
  };
}

describe("santé de Jellyfin", () => {
  it("une socket fermée alors que la sonde répond : rien ne bouge", async () => {
    const h = harness();
    h.machine.socketLost();
    await h.advance(10_000);
    expect(h.states).toEqual([]);
    expect(h.probes).toHaveLength(1);
    expect(h.pendingTimers()).toBe(0);
  });

  it("un seul échec ne fait pas « arrêté » : il en faut deux de suite", async () => {
    const h = harness();
    h.answer("fail", "ok");
    h.machine.socketLost();
    await h.advance(10_000);
    expect(h.states).toEqual([]);
    h.answer("fail", "fail");
    h.machine.socketLost();
    await h.advance(PROBE_INTERVAL_MS);
    expect(h.states.map((s) => s.state)).toEqual(["down"]);
  });

  it("docker kill puis docker start : arrêté en 3 s, chargement, retour", async () => {
    const h = harness();
    const t0 = h.now();
    h.otherwise("fail");
    h.machine.socketLost();
    await h.advance(PROBE_INTERVAL_MS);
    expect(h.machine.current().state).toBe("down");
    expect(h.states[0].at - t0).toBe(PROBE_INTERVAL_MS);
    h.otherwise("starting");
    await h.advance(PROBE_INTERVAL_MS);
    expect(h.machine.current().state).toBe("starting");
    h.otherwise("ok");
    await h.advance(PROBE_FAST_MS);
    expect(h.states.map((s) => s.state)).toEqual(["down", "starting", "up"]);
    expect(h.pendingTimers()).toBe(0);
  });

  it("ServerRestarting : « redémarre » tout de suite, puis chargement, puis retour", async () => {
    const h = harness();
    // Séquence mesurée (POST /System/Restart) : fermé, 503 × 6, puis 200 PascalCase.
    h.answer("fail", "starting", "starting", "starting", "starting", "starting", "starting", "ok");
    h.machine.announce("restarting");
    expect(h.machine.current().state).toBe("restarting");
    await h.advance(PROBE_FAST_MS * 8);
    expect(h.states.map((s) => s.state)).toEqual(["restarting", "starting", "up"]);
  });

  it("annoncé mais encore servi : un « ok » d'avant la chute ne ramène pas « up »", async () => {
    const h = harness();
    h.answer("ok", "fail", "starting", "ok");
    h.machine.announce("shutting-down");
    await h.advance(PROBE_FAST_MS);
    expect(h.machine.current().state).toBe("shutting-down");
    await h.advance(PROBE_FAST_MS * 3);
    expect(h.states.map((s) => s.state)).toEqual(["shutting-down", "starting", "up"]);
  });

  it("annoncé mais jamais tombé : « up » une fois la grâce passée", async () => {
    const h = harness();
    h.machine.announce("restarting");
    await h.advance(ANNOUNCED_GRACE_MS + PROBE_INTERVAL_MS);
    expect(h.states.map((s) => s.state)).toEqual(["restarting", "up"]);
  });

  it("docker restart : le 200 transitoire du serveur d'attente reste « starting »", async () => {
    const h = harness();
    // Mesuré : ServerShuttingDown, refus, 200 camelCase (classé starting), fermé, 503…, 200.
    h.answer("fail", "starting", "fail", "starting", "starting", "starting", "ok");
    h.machine.announce("shutting-down");
    await h.advance(PROBE_FAST_MS * 7);
    expect(h.states.map((s) => s.state)).toEqual(["shutting-down", "starting", "up"]);
  });

  it("docker stop : s'arrête, arrêté, puis retour au docker start", async () => {
    const h = harness();
    h.otherwise("fail");
    h.machine.announce("shutting-down");
    await h.advance(PROBE_FAST_MS * 2);
    expect(h.machine.current().state).toBe("down");
    await h.advance(60_000);
    expect(h.machine.current().state).toBe("down");
    h.otherwise("starting");
    await h.advance(PROBE_INTERVAL_MS);
    h.otherwise("ok");
    await h.advance(PROBE_FAST_MS);
    expect(h.states.map((s) => s.state)).toEqual(["shutting-down", "down", "starting", "up"]);
  });

  it("un redémarrage annoncé qui ne revient pas devient « arrêté » après la patience", async () => {
    const h = harness();
    h.otherwise("fail");
    h.machine.announce("restarting");
    await h.advance(RESTART_PATIENCE_MS - PROBE_INTERVAL_MS);
    expect(h.machine.current().state).toBe("restarting");
    await h.advance(PROBE_INTERVAL_MS * 2);
    expect(h.machine.current().state).toBe("down");
  });

  it("la socket qui rouvre sonde aussitôt, sans attendre la cadence", async () => {
    const h = harness();
    h.otherwise("fail");
    h.machine.socketLost();
    await h.advance(PROBE_INTERVAL_MS);
    expect(h.machine.current().state).toBe("down");
    h.otherwise("ok");
    const before = h.probes.length;
    h.machine.socketOpened();
    await h.advance(1);
    expect(h.probes.length).toBe(before + 1);
    expect(h.machine.current().state).toBe("up");
  });

  it("`since` date le début de l'état", async () => {
    const h = harness();
    h.machine.announce("restarting");
    expect(h.machine.current().since).toBe(h.now());
  });
});
