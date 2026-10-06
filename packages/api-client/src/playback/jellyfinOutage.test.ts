import { beforeEach, describe, expect, it } from "vitest";
import {
  getJellyfinHealth,
  onJellyfinHealth,
  receiveJellyfinHealth,
  resetJellyfinHealthForTests,
} from "../socket/jellyfinHealth";
import { LONG_OUTAGE_MS, RECOVERY_GRACE_MS, outageView, veilYieldsToPlayer } from "./jellyfinOutage";

/**
 * La panne de Jellyfin côté lecteur : le magasin (alimenté par
 * `server:jellyfin`) et la règle — bandeau, écran d'arrêt quand ça dure,
 * reprise une fois par retour, détecteurs muets le temps qu'il faut.
 */

let now = 1_000_000;
beforeEach(() => {
  now = 1_000_000;
  resetJellyfinHealthForTests(() => now);
});

describe("magasin de l'état de Jellyfin", () => {
  it("un retour compte une reprise, et une seule", () => {
    const seen: number[] = [];
    onJellyfinHealth((h) => seen.push(h.recoveries));
    receiveJellyfinHealth("restarting", 10);
    receiveJellyfinHealth("starting", 20);
    receiveJellyfinHealth("up", 30);
    receiveJellyfinHealth("up", 30);
    expect(getJellyfinHealth().recoveries).toBe(1);
    expect(seen).toEqual([0, 0, 1]);
  });

  it("« up » reçu à la connexion, Jellyfin déjà là : aucune reprise", () => {
    receiveJellyfinHealth("up", 5);
    expect(getJellyfinHealth().recoveries).toBe(0);
  });

  it("la panne est datée à sa première nouvelle, pas à chaque changement d'état", () => {
    receiveJellyfinHealth("shutting-down", 10);
    now += 4_000;
    receiveJellyfinHealth("down", 20);
    expect(getJellyfinHealth().outageSeenAt).toBe(1_000_000);
  });
});

describe("règle du lecteur pendant une panne", () => {
  it("Jellyfin là : rien", () => {
    const view = outageView(getJellyfinHealth(), now);
    expect(view).toMatchObject({ phase: "none", suppressErrors: false, nextChangeInMs: null });
  });

  it("panne : bandeau, détecteurs muets, l'écran d'arrêt au bout de LONG_OUTAGE_MS", () => {
    receiveJellyfinHealth("down", 0);
    expect(outageView(getJellyfinHealth(), now)).toMatchObject({ phase: "outage", suppressErrors: true, nextChangeInMs: LONG_OUTAGE_MS });
    expect(outageView(getJellyfinHealth(), now + LONG_OUTAGE_MS).phase).toBe("long");
  });

  it("un lecteur arrivé en pleine panne la date au début dit par le serveur", () => {
    const serverAhead = 2_000;
    receiveJellyfinHealth("down", now + serverAhead - 170_000);
    expect(outageView(getJellyfinHealth(), now, serverAhead)).toMatchObject({ phase: "outage", nextChangeInMs: 10_000 });
  });

  it("retour : reprise, détecteurs muets encore RECOVERY_GRACE_MS", () => {
    receiveJellyfinHealth("restarting", 0);
    now += 8_000;
    receiveJellyfinHealth("up", 8_000);
    const view = outageView(getJellyfinHealth(), now);
    expect(view).toMatchObject({ phase: "recovering", suppressErrors: true, recoveries: 1, nextChangeInMs: RECOVERY_GRACE_MS });
    expect(outageView(getJellyfinHealth(), now + RECOVERY_GRACE_MS)).toMatchObject({ phase: "none", suppressErrors: false });
  });
});

describe("le voile « serveur injoignable » et le lecteur", () => {
  it("lecteur ouvert, Jellyfin seul en panne DITE par le serveur : le voile cède au message du lecteur", () => {
    for (const phase of ["outage", "long", "recovering"] as const) {
      expect(veilYieldsToPlayer({ playerOpen: true, reason: "jellyfin", phase })).toBe(true);
    }
  });

  it("hors lecteur, Tentacle injoignable, ou panne que le serveur ne dit pas : le voile, comme avant", () => {
    expect(veilYieldsToPlayer({ playerOpen: false, reason: "jellyfin", phase: "outage" })).toBe(false);
    expect(veilYieldsToPlayer({ playerOpen: true, reason: "backend", phase: "outage" })).toBe(false);
    expect(veilYieldsToPlayer({ playerOpen: true, reason: "jellyfin", phase: "none" })).toBe(false);
  });
});
