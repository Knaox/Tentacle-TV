import { describe, expect, it } from "vitest";
import { RETURN_STALL_MS, RETURN_WATCH_MS, type JellyfinHealthState } from "@tentacle-tv/shared";
import { createOutageGate } from "./outageGate";

/**
 * Le portillon des erreurs pendant une panne — la règle que le web, le bureau
 * et le mobile partagent. Horloge et minuteries simulées.
 */

function harness(opts: { started?: boolean; streamLost?: () => boolean | Promise<boolean> } = {}) {
  let state: JellyfinHealthState = "up";
  let clock = 0;
  let timers: Array<{ at: number; run: () => void; live: boolean }> = [];
  const log: string[] = [];
  const gate = createOutageGate<string>({
    state: () => state,
    started: () => opts.started ?? true,
    reopen: () => log.push("rouvre"),
    diagnose: (f) => log.push(`diagnostic ${f}`),
    streamLost: opts.streamLost,
    now: () => clock,
    schedule: (run, ms) => {
      const timer = { at: clock + ms, run, live: true };
      timers.push(timer);
      return () => { timer.live = false; };
    },
  });
  return {
    gate, log,
    set(next: JellyfinHealthState) { state = next; },
    advance(ms: number) {
      clock += ms;
      const due = timers.filter((t) => t.live && t.at <= clock);
      timers = timers.filter((t) => !due.includes(t));
      for (const t of due) { t.live = false; t.run(); }
    },
  };
}

describe("portillon des erreurs pendant une panne de Jellyfin", () => {
  it("hors panne : chaque erreur suit son chemin ordinaire", () => {
    const h = harness();
    h.gate.report("décodage");
    expect(h.log).toEqual(["diagnostic décodage"]);
  });

  it("retour TRANSPARENT : une lecture qui a tenu sur sa réserve n'est pas rechargée", () => {
    const h = harness();
    h.set("restarting");
    h.advance(8000);
    h.set("up");
    h.gate.recovered();
    h.advance(RETURN_WATCH_MS);
    expect(h.log).toEqual([]);
  });

  it("panne : les erreurs se taisent ; le flux perdu pendant la panne se rouvre au retour", () => {
    const h = harness();
    h.set("down");
    h.gate.report("réseau");
    h.gate.report("délai");
    expect(h.log).toEqual([]);
    h.set("up");
    h.gate.recovered();
    expect(h.log).toEqual(["rouvre"]);
  });

  it("une lecture pas encore démarrée se rouvre au retour", () => {
    const h = harness({ started: false });
    h.set("down");
    h.set("up");
    h.gate.recovered();
    expect(h.log).toEqual(["rouvre"]);
  });

  it("après le retour : la première erreur rouvre, la suivante est diagnostiquée", () => {
    const h = harness();
    h.gate.recovered();
    h.advance(60_000);
    h.gate.report("segment introuvable");
    h.gate.report("vrai problème");
    expect(h.log).toEqual(["rouvre", "diagnostic vrai problème"]);
  });

  it("passé la fenêtre d'après-retour, une erreur est un vrai problème", () => {
    const h = harness();
    h.gate.recovered();
    h.advance(RETURN_WATCH_MS);
    h.gate.report("décodage");
    expect(h.log).toEqual(["diagnostic décodage"]);
  });

  it("image arrêtée au bout de la réserve : le lecteur a RETURN_STALL_MS pour se reconnecter seul", () => {
    const h = harness();
    h.gate.recovered();
    h.advance(20_000);
    h.gate.stalled(true);
    h.advance(RETURN_STALL_MS - 1);
    h.gate.stalled(false);
    h.advance(RETURN_STALL_MS);
    expect(h.log).toEqual([]);
    h.gate.stalled(true);
    h.advance(RETURN_STALL_MS);
    expect(h.log).toEqual(["rouvre"]);
    // Une fois par retour : un nouvel arrêt attend le diagnostic ordinaire.
    h.gate.stalled(false);
    h.gate.stalled(true);
    h.advance(RETURN_STALL_MS * 2);
    expect(h.log).toEqual(["rouvre"]);
  });

  it("arrêtée PENDANT la panne : le délai court depuis le retour", () => {
    const h = harness();
    h.set("down");
    h.gate.stalled(true);
    h.advance(30_000);
    expect(h.log).toEqual([]);
    h.set("up");
    h.gate.recovered();
    h.advance(RETURN_STALL_MS - 1);
    expect(h.log).toEqual([]);
    h.advance(1);
    expect(h.log).toEqual(["rouvre"]);
  });

  it("chaque retour réarme une réouverture", () => {
    const h = harness();
    h.gate.recovered();
    h.gate.report("a");
    h.gate.recovered();
    h.gate.report("b");
    expect(h.log).toEqual(["rouvre", "rouvre"]);
  });

  it("une 2e panne PENDANT la fenêtre d'après-retour : rien ne se rouvre avant SON retour", () => {
    const h = harness();
    h.gate.recovered();
    h.advance(40_000);
    h.set("down");
    h.gate.stalled(true);
    h.advance(RETURN_STALL_MS * 4);
    h.gate.report("réseau");
    expect(h.log).toEqual([]);
    h.set("up");
    h.gate.recovered();
    // Le flux a cassé pendant la panne : une réouverture, une seule.
    expect(h.log).toEqual(["rouvre"]);
    h.advance(RETURN_STALL_MS * 2);
    expect(h.log).toEqual(["rouvre"]);
  });

  it("une image arrêtée quand la panne recommence : le minuteur ne rouvre rien", () => {
    const h = harness();
    h.gate.recovered();
    h.gate.stalled(true);
    h.set("restarting");
    h.advance(RETURN_STALL_MS);
    expect(h.log).toEqual([]);
  });

  it("le moteur a perdu son flux sans erreur (mpv, segments sautés) : rouvert au retour", () => {
    const h = harness({ streamLost: () => true });
    h.set("down");
    h.set("up");
    h.gate.recovered();
    expect(h.log).toEqual(["rouvre"]);
  });

  it("la vérification du moteur peut répondre plus tard ; rien si une autre panne l'a devancée", async () => {
    let answer: (lost: boolean) => void = () => undefined;
    const h = harness({ streamLost: () => new Promise<boolean>((r) => { answer = r; }) });
    h.gate.recovered();
    expect(h.log).toEqual([]);
    answer(true);
    await Promise.resolve();
    expect(h.log).toEqual(["rouvre"]);

    let late: (lost: boolean) => void = () => undefined;
    const g = harness({ streamLost: () => new Promise<boolean>((r) => { late = r; }) });
    g.gate.recovered();
    g.set("down");
    g.gate.report("réseau");
    late(true);
    await Promise.resolve();
    expect(g.log).toEqual([]);
  });

  it("flux intact selon le moteur : lecture gardée", async () => {
    const h = harness({ streamLost: () => Promise.resolve(false) });
    h.gate.recovered();
    await Promise.resolve();
    h.advance(RETURN_WATCH_MS);
    expect(h.log).toEqual([]);
  });
});
