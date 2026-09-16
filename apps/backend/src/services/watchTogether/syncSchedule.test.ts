/**
 * La reprise planifiée : tous les lecteurs repartent au même instant serveur.
 * Trois choses à tenir : le délai suit le membre en lecture le plus lent
 * (borné), une mutation sans position pendant la fenêtre n'écrase pas l'ancre,
 * et un client d'avant — qui joue déjà — ancre la salle là où il SERA.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const online = new Set<string>();
vi.mock("../wsManager", () => ({
  isUserOnline: (userId: string) => online.has(userId),
  sendToUser: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { applyCommand, bumpEpoch, expireStaleWaits } from "./sync";
import { computeLead, hasFutureAnchor, scheduleResume } from "./syncSchedule";
import { TICKS_PER_MS, WT_GROUP_WAIT_TIMEOUT_MS, wtPositionTicksAt } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

const NOW = 1_700_000_000_000;
const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const isOnline = (userId: string) => online.has(userId);

let room: Room;
let hostMember: RoomMember;
let guestMember: RoomMember;

beforeAll(() => { vi.useFakeTimers(); });
beforeEach(() => {
  vi.setSystemTime(NOW);
  online.clear();
  online.add(host.userId);
  online.add(guest.userId);
  room = createRoom(host, null)!;
  addMember(room, guest);
  room.itemId = "item";
  hostMember = room.members.get(host.userId)!;
  guestMember = room.members.get(guest.userId)!;
  for (const m of [hostMember, guestMember]) { m.inPlayback = true; m.protocolVersion = 2; }
});
afterEach(() => { removeMember(guest.userId); removeMember(host.userId); });

describe("computeLead — le membre en lecture le plus lent, borné", () => {
  it("sans aller-retour déclaré : le défaut plus la marge", () => {
    expect(computeLead(room)).toBe(350);
  });

  it("un aller-retour court ne descend pas sous le plancher", () => {
    hostMember.rttMs = 30; guestMember.rttMs = 20;
    expect(computeLead(room)).toBe(180);
  });

  it("un aller-retour long ne dépasse pas le plafond", () => {
    guestMember.rttMs = 2_000;
    expect(computeLead(room)).toBe(900);
  });

  it("un membre hors lecture ou hors ligne ne compte pas", () => {
    guestMember.rttMs = 2_000;
    guestMember.inPlayback = false;
    expect(computeLead(room)).toBe(350);
    guestMember.inPlayback = true;
    online.delete(guest.userId);
    expect(computeLead(room)).toBe(350);
  });
});

describe("l'ancre d'une reprise planifiée", () => {
  it("survit à une mutation sans position (présence, entrée) pendant la fenêtre", () => {
    room.paused = true; room.pauseReason = "user"; room.positionTicks = 5_000 * TICKS_PER_MS;
    scheduleResume(room, NOW, room.positionTicks);
    const anchor = room.stateAtServerTime;
    expect(anchor).toBe(NOW + 350);
    const epoch = room.epoch;
    vi.setSystemTime(NOW + 100);
    bumpEpoch(room);
    expect(room.stateAtServerTime).toBe(anchor);
    expect(room.positionTicks).toBe(5_000 * TICKS_PER_MS);
    expect(room.epoch).toBe(epoch + 1);
    expect(hasFutureAnchor(room, NOW + 100)).toBe(true);
  });

  it("n'avance pas la position avant l'instant de reprise, puis la fait courir", () => {
    room.paused = true; room.pauseReason = "user"; room.positionTicks = 1_000 * TICKS_PER_MS;
    scheduleResume(room, NOW, room.positionTicks);
    expect(wtPositionTicksAt(room, NOW + 200)).toBe(1_000 * TICKS_PER_MS);
    expect(wtPositionTicksAt(room, NOW + 350 + 100)).toBe(1_100 * TICKS_PER_MS);
  });

  it("une pause pendant la fenêtre fige la salle à la position envoyée", () => {
    room.paused = true; room.pauseReason = "user"; room.positionTicks = 1_000 * TICKS_PER_MS;
    scheduleResume(room, NOW, room.positionTicks);
    vi.setSystemTime(NOW + 100);
    const out = applyCommand(room, guestMember, { type: "wt:pause", positionTicks: 1_000 * TICKS_PER_MS }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "pause" });
    expect(room.paused).toBe(true);
    expect(room.stateAtServerTime).toBe(NOW + 100);
    expect(hasFutureAnchor(room, NOW + 100)).toBe(false);
  });
});

describe("wt:play — une reprise planifiée", () => {
  beforeEach(() => { room.paused = true; room.pauseReason = "user"; room.positionTicks = 0; });

  it("d'un lecteur v2 : la salle repart de SA position, à T = now + lead", () => {
    hostMember.rttMs = 40; guestMember.rttMs = 60;
    const out = applyCommand(room, hostMember, { type: "wt:play", positionTicks: 2_000 * TICKS_PER_MS }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "play" });
    expect(room.paused).toBe(false);
    expect(room.positionTicks).toBe(2_000 * TICKS_PER_MS);
    expect(room.stateAtServerTime).toBe(NOW + 180);
  });

  it("d'un client d'avant qui joue déjà : ancrée là où il SERA à T", () => {
    hostMember.protocolVersion = 1; hostMember.rttMs = null; // défaut 250 → lead 350
    applyCommand(room, hostMember, { type: "wt:play", positionTicks: 2_000 * TICKS_PER_MS }, isOnline);
    expect(room.stateAtServerTime).toBe(NOW + 350);
    expect(room.positionTicks).toBe((2_000 + 125 + 350) * TICKS_PER_MS);
  });

  it("en lecture : ignoré", () => {
    room.paused = false;
    expect(applyCommand(room, hostMember, { type: "wt:play", positionTicks: 0 }, isOnline)).toEqual({ kind: "ignore" });
  });
});

describe("la fin d'un group-wait est une reprise planifiée", () => {
  it("le dernier membre prêt programme la reprise depuis la position gelée", () => {
    room.paused = false; room.positionTicks = 3_000 * TICKS_PER_MS; room.stateAtServerTime = NOW;
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: true, positionTicks: 3_100 * TICKS_PER_MS }, isOnline);
    expect(room.paused).toBe(true);
    expect(room.pauseReason).toBe("buffering");
    vi.setSystemTime(NOW + 2_000);
    const out = applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, rttMs: 500 }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "schedule" });
    expect(room.paused).toBe(false);
    expect(room.positionTicks).toBe(3_100 * TICKS_PER_MS);
    expect(room.stateAtServerTime).toBe(NOW + 2_000 + 600);
  });

  it("le sweep anti-gel reprend lui aussi à un instant planifié", () => {
    room.paused = false; room.positionTicks = 0; room.stateAtServerTime = NOW;
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: true }, isOnline);
    vi.setSystemTime(NOW + WT_GROUP_WAIT_TIMEOUT_MS);
    const { expired, resumed } = expireStaleWaits(room, NOW + WT_GROUP_WAIT_TIMEOUT_MS);
    expect(expired).toEqual([guest.userId]);
    expect(resumed).toBe(true);
    expect(room.stateAtServerTime).toBeGreaterThan(NOW + WT_GROUP_WAIT_TIMEOUT_MS);
  });
});
