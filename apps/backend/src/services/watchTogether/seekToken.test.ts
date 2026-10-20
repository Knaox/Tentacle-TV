/**
 * Les sauts rapides (B7) : chaque seek porte le jeton `appareil:numéro` de son
 * émetteur ; la salle le garde tant que la position est la sienne et le rend
 * dans l'état (l'émetteur reconnaît l'écho d'un de ses seeks plus anciens) ;
 * un seek plus ancien du même appareil est ignoré.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../wsManager", () => ({
  isUserOnline: () => true,
  sendToUser: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { applyCommand } from "./sync";
import { roomToDto } from "./broadcast";
import { parseWtClientMessage } from "./protocolParse";
import { TICKS_PER_MS } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const online = () => true;
const S = (seconds: number) => seconds * 1_000 * TICKS_PER_MS;

let room: Room;
let hostMember: RoomMember;

beforeAll(() => { vi.useFakeTimers(); });
beforeEach(() => {
  room = createRoom(host, null)!;
  addMember(room, guest);
  room.itemId = "film";
  hostMember = room.members.get(host.userId)!;
  for (const m of room.members.values()) { m.inPlayback = true; m.protocolVersion = 2; }
  room.paused = false; room.pauseReason = null; room.positionTicks = S(100); room.stateAtServerTime = Date.now();
});
afterEach(() => {
  removeMember(guest.userId);
  removeMember(host.userId);
  vi.clearAllTimers();
});

describe("le jeton d'un seek", () => {
  it("la salle le garde et le rend dans l'état", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(130), seekToken: "abc:1" }, online);
    expect(roomToDto(room).seekToken).toBe("abc:1");
  });

  it("un seek plus ancien du même appareil est ignoré ; celui d'un autre appareil passe", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(340), seekToken: "abc:8" }, online);
    expect(applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(160), seekToken: "abc:2" }, online))
      .toEqual({ kind: "ignore" });
    expect(room.positionTicks).toBe(S(340));
    expect(applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(200), seekToken: "xyz:1" }, online).kind)
      .toBe("broadcast");
    expect(room.positionTicks).toBe(S(200));
  });

  it("un autre geste déplace la position : plus de jeton (client d'avant compris)", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(130), seekToken: "abc:1" }, online);
    applyCommand(room, hostMember, { type: "wt:pause", positionTicks: S(131) }, online);
    expect(roomToDto(room).seekToken).toBeUndefined();
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(150), seekToken: "abc:2" }, online);
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(155) }, online);
    expect(roomToDto(room).seekToken).toBeUndefined();
  });

  it("un jeton mal formé est oublié à l'entrée, le seek reste valable", () => {
    expect(parseWtClientMessage({ type: "wt:seek", positionTicks: 10, seekToken: "x".repeat(80) }))
      .toEqual({ type: "wt:seek", positionTicks: 10 });
    expect(parseWtClientMessage({ type: "wt:seek", positionTicks: 10, seekToken: "ab12:7" }))
      .toEqual({ type: "wt:seek", positionTicks: 10, seekToken: "ab12:7" });
  });
});
