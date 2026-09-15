import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../wsManager", () => ({ isUserOnline: () => true, sendToUser: () => undefined }));

import { addMember, createRoom, removeMember } from "./roomStore";
import { recordTick } from "./syncBeacon";
import { TICKS_PER_MS } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

const NOW = 1_700_000_000_000;
const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const S = (seconds: number) => seconds * 1_000 * TICKS_PER_MS;
let room: Room;
let member: RoomMember;

beforeEach(() => {
  room = createRoom(host, null)!;
  addMember(room, host);
  member = room.members.get(host.userId)!;
  room.itemId = "item";
  room.paused = false; room.pauseReason = null; room.positionTicks = S(100); room.stateAtServerTime = NOW;
});
afterEach(() => { removeMember(host.userId); });

describe("recordTick", () => {
  it("mesure l'écart à l'instant de la lecture du lecteur, pas à la réception", () => {
    // À NOW+1000, la salle est à 101 s ; le lecteur se lisait à 101,04 s.
    const due = recordTick(room, member, { positionTicks: S(101.04), paused: false, atServerTime: NOW + 1_000, rttMs: 30 }, NOW + 1_020);
    expect(due).toBe(true);
    expect(member.driftMs).toBe(40);
    expect(member.rttMs).toBe(30);
  });

  it("un lecteur en pause pendant que la salle joue n'a pas d'écart", () => {
    recordTick(room, member, { positionTicks: S(50), paused: true, atServerTime: NOW + 1_000 }, NOW + 1_000);
    expect(member.driftMs).toBeNull();
  });

  it("les diffusions sont limitées à une par 5 s et par salle", () => {
    expect(recordTick(room, member, { positionTicks: S(101), paused: false, atServerTime: NOW + 1_000 }, NOW + 1_000)).toBe(true);
    expect(recordTick(room, member, { positionTicks: S(103), paused: false, atServerTime: NOW + 3_000 }, NOW + 3_000)).toBe(false);
    expect(recordTick(room, member, { positionTicks: S(106), paused: false, atServerTime: NOW + 6_000 }, NOW + 6_000)).toBe(true);
  });
});
