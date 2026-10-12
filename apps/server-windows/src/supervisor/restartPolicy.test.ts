import { describe, expect, it } from "vitest";
import { BACKOFF_MS, LOOP_LIMIT, LOOP_WINDOW_MS, RestartPolicy } from "./restartPolicy";

const crash = { code: 1, requestedByHost: false, startupFailure: null } as const;

describe("RestartPolicy", () => {
  it("ne relance jamais un arrêt demandé par l'hôte, quel que soit le code", () => {
    const policy = new RestartPolicy(() => 0);
    expect(policy.decide({ code: 1, requestedByHost: true, startupFailure: null })).toEqual({ action: "stopped" });
    expect(policy.decide({ code: null, requestedByHost: true, startupFailure: null })).toEqual({ action: "stopped" });
  });

  it("relance aussitôt sur 75, sans compter un échec", () => {
    const policy = new RestartPolicy(() => 0);
    for (let i = 0; i < LOOP_LIMIT + 2; i++) {
      expect(policy.decide({ code: 75, requestedByHost: false, startupFailure: null })).toEqual({ action: "restart", delayMs: 0 });
    }
  });

  it("tient un 0 inattendu pour un arrêt", () => {
    expect(new RestartPolicy().decide({ code: 0, requestedByHost: false, startupFailure: null })).toEqual({ action: "stopped" });
  });

  it("ne boucle pas sur une cause de démarrage connue", () => {
    const policy = new RestartPolicy(() => 0);
    expect(policy.decide({ code: 1, requestedByHost: false, startupFailure: "port_in_use" })).toEqual({ action: "blocked", cause: "port_in_use" });
    expect(policy.decide({ code: 1, requestedByHost: false, startupFailure: "already_running" })).toEqual({ action: "blocked", cause: "already_running" });
    expect(policy.decide({ code: 1, requestedByHost: false, startupFailure: "data_dir_unwritable" })).toEqual({ action: "blocked", cause: "data_dir_unwritable" });
  });

  it("traite « unexpected » comme un plantage, avec délai croissant", () => {
    const policy = new RestartPolicy(() => 0);
    expect(policy.decide({ code: 1, requestedByHost: false, startupFailure: "unexpected" })).toEqual({ action: "restart", delayMs: BACKOFF_MS[0] });
    expect(policy.decide(crash)).toEqual({ action: "restart", delayMs: BACKOFF_MS[1] });
  });

  it("s'arrête de relancer après une boucle de plantages, puis oublie les anciens", () => {
    let now = 0;
    const policy = new RestartPolicy(() => now);
    for (let i = 0; i < LOOP_LIMIT - 1; i++) expect(policy.decide(crash).action).toBe("restart");
    expect(policy.decide(crash)).toEqual({ action: "blocked", cause: "crash_loop" });
    now += LOOP_WINDOW_MS + 1;
    expect(policy.decide(crash)).toEqual({ action: "restart", delayMs: BACKOFF_MS[0] });
  });

  it("repart du premier délai après reset", () => {
    const policy = new RestartPolicy(() => 0);
    policy.decide(crash);
    policy.decide(crash);
    policy.reset();
    expect(policy.decide({ code: null, requestedByHost: false, startupFailure: null })).toEqual({ action: "restart", delayMs: BACKOFF_MS[0] });
  });
});
