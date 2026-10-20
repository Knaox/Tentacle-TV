import { describe, expect, it } from "vitest";
import { isRoomWaitingForMe, wtBufferingFreezeSeconds, wtJoinStartSeconds, wtReadyMisplaced } from "./sessionRules";

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

describe("isRoomWaitingForMe — prêt pendant qu'on m'attend : rester en pause", () => {
  const room = (patch: Partial<Parameters<typeof isRoomWaitingForMe>[0] & object>) => ({
    groupId: "g", hostUserId: "a", epoch: 1, itemId: "film", paused: true, positionTicks: 0, stateAtServerTime: 0,
    pauseReason: "buffering" as const, waitingForUserIds: ["b"], members: [], ...patch,
  });

  it("la salle en pause m'attend (arrivée, chargement, barrière) : oui", () => {
    expect(isRoomWaitingForMe(room({}), "b")).toBe(true);
    expect(isRoomWaitingForMe(room({ pauseReason: "user", barrierId: 4 }), "b")).toBe(true);
  });

  it("elle attend un autre, elle joue, ou pas de salle : non", () => {
    expect(isRoomWaitingForMe(room({}), "a")).toBe(false);
    expect(isRoomWaitingForMe(room({ paused: false }), "b")).toBe(false);
    expect(isRoomWaitingForMe(null, "b")).toBe(false);
  });
});

describe("wtReadyMisplaced — « prêt » seulement une fois posé à sa position de départ", () => {
  const waiting = {
    groupId: "g", hostUserId: "a", epoch: 1, itemId: "film", paused: true, positionTicks: 276.4 * SECOND,
    stateAtServerTime: 0, pauseReason: "buffering" as const, waitingForUserIds: ["b"], members: [],
  };

  it("prêt à 0 s quand la salle l'attend à 276 s : non ; à côté (atterrissage d'un flux transcodé) : oui", () => {
    expect(wtReadyMisplaced(waiting, NOW, 0, "b")).toBe(true);
    expect(wtReadyMisplaced(waiting, NOW, 270.1, "b")).toBe(false);
    expect(wtReadyMisplaced(waiting, NOW, 276.5, "b")).toBe(false);
  });

  it("la salle ne l'attend pas (elle attend un autre, elle joue) : rien à retenir", () => {
    expect(wtReadyMisplaced(waiting, NOW, 0, "a")).toBe(false);
    expect(wtReadyMisplaced({ ...waiting, paused: false }, NOW, 0, "b")).toBe(false);
  });
});
