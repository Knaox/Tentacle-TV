import { describe, expect, it } from "vitest";
import { wtBufferingFreezeSeconds, wtJoinStartSeconds } from "./sessionRules";

/**
 * L'arrivée côté lecteur (retour de Damien du 20/10) : où le nouveau ouvre son
 * lecteur, et ce que son « je charge » dit de la position — jamais celle d'un
 * lecteur qui n'a encore rien lu (la salle reculait).
 */

const SECOND = 10_000_000;
const NOW = 1_000_000;

describe("wtJoinStartSeconds — le nouveau s'ouvre là où la salle l'attend", () => {
  it("salle gelée au clic : la position EXACTE de la pause, quel que soit l'aller-retour", () => {
    const frozen = { paused: true, positionTicks: 42.5 * SECOND, stateAtServerTime: NOW - 3_000 };
    expect(wtJoinStartSeconds(frozen, NOW, 400)).toBe(42.5);
  });

  it("salle en lecture : là où elle sera à la réception de ma déclaration (un aller simple)", () => {
    const playing = { paused: false, positionTicks: 10 * SECOND, stateAtServerTime: NOW };
    expect(wtJoinStartSeconds(playing, NOW, 200)).toBeCloseTo(10.1, 5);
    expect(wtJoinStartSeconds(playing, NOW, null)).toBe(10);
  });

  it("reprise planifiée encore à venir : sa position gelée", () => {
    const scheduled = { paused: false, positionTicks: 10 * SECOND, stateAtServerTime: NOW + 500 };
    expect(wtJoinStartSeconds(scheduled, NOW, 200)).toBe(10);
  });
});

describe("wtBufferingFreezeSeconds — la position d'un « je charge »", () => {
  it("premier chargement, reconnexion en plein chargement : aucune position (la salle garde la sienne)", () => {
    expect(wtBufferingFreezeSeconds({ playerS: 0, wasReady: false })).toBeUndefined();
    expect(wtBufferingFreezeSeconds({ playerS: 31.2, wasReady: false })).toBeUndefined();
  });

  it("calage en pleine lecture : la position du lecteur ; rechargement : celle qu'il vise", () => {
    expect(wtBufferingFreezeSeconds({ playerS: 95.4, wasReady: true })).toBe(95.4);
    expect(wtBufferingFreezeSeconds({ freezeAtS: 120, playerS: 0, wasReady: false })).toBe(120);
  });
});
