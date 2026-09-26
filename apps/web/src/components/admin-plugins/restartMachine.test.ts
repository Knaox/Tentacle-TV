/**
 * Le suivi d'un redémarrage : revenu quand un AUTRE processus répond, jamais
 * sur la foi du processus qui s'apprête à sortir ; bloqué passé le délai,
 * mais toujours à l'écoute.
 */

import { describe, expect, it } from "vitest";
import { STUCK_AFTER_MS, loadFailures, onHealthSample, pollDelay, startRestart } from "./restartMachine";

const T0 = 1_000_000;

describe("onHealthSample", () => {
  it("le processus qui annonce le redémarrage répond encore : on attend", () => {
    const phase = onHealthSample(startRestart("boot-a", "Vigie", T0), { reachable: true, bootId: "boot-a" }, T0 + 500);
    expect(phase).toMatchObject({ kind: "waiting", sawDown: false });
  });

  it("un nouveau processus répond : le serveur est revenu, avec ses modules en échec", () => {
    let phase = startRestart("boot-a", "Vigie", T0);
    phase = onHealthSample(phase, { reachable: false }, T0 + 1500);
    phase = onHealthSample(phase, {
      reachable: true,
      bootId: "boot-b",
      loadResults: [
        { pluginId: "vigie", status: "loaded" },
        { pluginId: "stats", status: "error", detail: "Cannot find module" },
        { pluginId: "theme", status: "no_server" },
      ],
    }, T0 + 6000);
    expect(phase).toEqual({ kind: "back", at: T0 + 6000, label: "Vigie", failures: [{ pluginId: "stats", detail: "Cannot find module" }] });
  });

  it("un redémarrage trop rapide pour être vu reste reconnu à l'identifiant", () => {
    const phase = onHealthSample(startRestart("boot-a", null, T0), { reachable: true, bootId: "boot-b" }, T0 + 3000);
    expect(phase.kind).toBe("back");
  });

  it("sans identifiant (serveur ancien), revenu seulement après une coupure constatée", () => {
    let phase = startRestart(null, null, T0);
    phase = onHealthSample(phase, { reachable: true, bootId: null }, T0 + 500);
    expect(phase.kind).toBe("waiting");
    phase = onHealthSample(phase, { reachable: false }, T0 + 1500);
    phase = onHealthSample(phase, { reachable: true, bootId: null }, T0 + 4000);
    expect(phase.kind).toBe("back");
  });

  it("passé le délai, le suivi se dit bloqué mais continue", () => {
    let phase = startRestart("boot-a", null, T0);
    phase = onHealthSample(phase, { reachable: false }, T0 + STUCK_AFTER_MS);
    expect(phase).toMatchObject({ kind: "waiting", stuck: true });
    phase = onHealthSample(phase, { reachable: true, bootId: "boot-b" }, T0 + STUCK_AFTER_MS + 3000);
    expect(phase.kind).toBe("back");
  });

  it("hors attente, un échantillon ne change rien", () => {
    expect(onHealthSample({ kind: "idle" }, { reachable: false }, T0)).toEqual({ kind: "idle" });
  });
});

describe("sondes", () => {
  it("serrées les trente premières secondes, plus lâches ensuite", () => {
    const phase = startRestart("boot-a", null, T0);
    expect(pollDelay(phase, T0 + 1000)).toBe(1000);
    expect(pollDelay(phase, T0 + 45_000)).toBe(3000);
    expect(pollDelay({ kind: "idle" }, T0)).toBe(0);
  });

  it("un diagnostic absent ne signale aucun échec", () => {
    expect(loadFailures({ reachable: true })).toEqual([]);
  });
});
