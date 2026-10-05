import { describe, expect, it } from "vitest";
import type { JellyfinHealthState } from "@tentacle-tv/shared";
import { createOutageGate } from "./outageGate";

/**
 * Le portillon des erreurs pendant une panne — la règle que le web, le bureau
 * et le mobile partagent ; le banc web la joue dans un vrai navigateur.
 */

function harness() {
  let state: JellyfinHealthState = "up";
  let suppressed = false;
  const log: string[] = [];
  const gate = createOutageGate<string>({
    state: () => state,
    suppressed: () => suppressed,
    reopen: () => log.push("rouvre"),
    diagnose: (f) => log.push(`diagnostic ${f}`),
  });
  return {
    gate, log,
    set(next: JellyfinHealthState, mute: boolean) { state = next; suppressed = mute; },
  };
}

describe("portillon des erreurs pendant une panne de Jellyfin", () => {
  it("hors panne : chaque erreur suit son chemin ordinaire", () => {
    const h = harness();
    h.gate.report("décodage");
    expect(h.log).toEqual(["diagnostic décodage"]);
  });

  it("panne : les erreurs se taisent, et le retour rouvre le flux — même sans erreur vue", () => {
    const h = harness();
    h.set("down", true);
    h.gate.report("réseau");
    h.gate.report("délai");
    expect(h.log).toEqual([]);
    h.set("up", true);
    h.gate.recovered();
    expect(h.log).toEqual(["rouvre"]);
  });

  it("reprise : la première erreur rouvre encore une fois, la suivante est diagnostiquée", () => {
    const h = harness();
    h.set("up", true);
    h.gate.recovered();
    h.gate.report("vieux flux");
    h.gate.report("vrai problème");
    expect(h.log).toEqual(["rouvre", "rouvre", "diagnostic vrai problème"]);
  });

  it("chaque retour réarme la relance de la reprise", () => {
    const h = harness();
    h.set("up", true);
    h.gate.recovered();
    h.gate.report("a");
    h.gate.recovered();
    h.gate.report("b");
    expect(h.log).toEqual(["rouvre", "rouvre", "rouvre", "rouvre"]);
  });
});
