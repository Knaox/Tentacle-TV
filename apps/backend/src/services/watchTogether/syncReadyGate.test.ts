/**
 * « Tous prêts » (1.31.1) : le bug de l'intro — « Passer l'intro » paraissait
 * avant que tous les membres soient arrivés, et le premier posé sautait seul.
 * La salle retient qui elle attend pour le titre ; tant qu'ils ne sont pas
 * posés, `allReady` est faux et une proposition de saut attend. Une barrière
 * en cours suspend `allReady` ; le délai ouvre la porte quoi qu'il arrive.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const online = new Set<string>();
vi.mock("../wsManager", () => ({
  isUserOnline: (userId: string) => online.has(userId),
  sendToUser: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { applyCommand } from "./sync";
import { deferSkip, onReadyGateOpened, takeDeferredSkip, wtAllReady, WT_READY_GATE_TIMEOUT_MS } from "./syncReadyGate";
import { WT_PROTOCOL_VERSION } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

const NOW = 1_700_000_000_000;
const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const isOnline = (userId: string) => online.has(userId);

let room: Room;
let hostMember: RoomMember;
let guestMember: RoomMember;

/** Un lecteur arrive sur le titre : présence, chargement, puis prêt. */
function arrive(member: RoomMember, itemId = "film"): void {
  applyCommand(room, member, { type: "wt:presence", inPlayback: true, itemId, protocolVersion: WT_PROTOCOL_VERSION }, isOnline);
  applyCommand(room, member, { type: "wt:buffering", buffering: true }, isOnline);
}
function ready(member: RoomMember): void {
  applyCommand(room, member, { type: "wt:buffering", buffering: false, barrierId: room.barrier?.id }, isOnline);
}

beforeAll(() => { vi.useFakeTimers(); });
beforeEach(() => {
  vi.setSystemTime(NOW);
  online.clear();
  online.add(host.userId); online.add(guest.userId);
  room = createRoom(host, null)!;
  addMember(room, guest);
  hostMember = room.members.get(host.userId)!;
  guestMember = room.members.get(guest.userId)!;
});
afterEach(() => {
  removeMember(guest.userId);
  removeMember(host.userId);
  vi.clearAllTimers();
});

describe("premier lancement : tous les membres en ligne sont attendus", () => {
  it("le lanceur posé ne suffit pas ; l'invité posé ouvre la porte", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" }, isOnline);
    expect(wtAllReady(room)).toBe(false);
    arrive(hostMember);
    ready(hostMember);
    expect(room.paused).toBe(false); // la salle joue déjà : le lanceur n'attend personne
    expect(wtAllReady(room)).toBe(false); // … mais l'intro ne se saute pas
    arrive(guestMember);
    expect(wtAllReady(room)).toBe(false);
    ready(guestMember);
    expect(wtAllReady(room)).toBe(true);
  });

  it("un attendu hors ligne ou incapable de lire ne compte plus", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" }, isOnline);
    arrive(hostMember); ready(hostMember);
    online.delete(guest.userId);
    expect(wtAllReady(room)).toBe(true);
  });

  it("le délai ouvre la porte, et le dit", () => {
    const opened = vi.fn();
    onReadyGateOpened(opened);
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" }, isOnline);
    arrive(hostMember); ready(hostMember);
    vi.advanceTimersByTime(WT_READY_GATE_TIMEOUT_MS);
    expect(opened).toHaveBeenCalledWith(room);
    expect(wtAllReady(room)).toBe(true);
  });

  it("une fois ouverte, la porte reste ouverte ; une barrière suspend seulement `allReady`", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" }, isOnline);
    arrive(hostMember); ready(hostMember); arrive(guestMember); ready(guestMember);
    expect(wtAllReady(room)).toBe(true);
    applyCommand(room, guestMember, { type: "wt:seek", positionTicks: 600_000_000 }, isOnline);
    expect(wtAllReady(room)).toBe(false);
    ready(hostMember); ready(guestMember);
    expect(wtAllReady(room)).toBe(true);
    // L'invité sort du lecteur puis revient : la porte ne se referme pas.
    applyCommand(room, guestMember, { type: "wt:presence", inPlayback: false }, isOnline);
    expect(wtAllReady(room)).toBe(true);
  });
});

describe("titre suivant : seuls ceux qui regardaient, et le lanceur", () => {
  it("un membre resté hors du lecteur n'est pas attendu", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "ep1", fromItemId: null, reason: "manual" }, isOnline);
    arrive(hostMember, "ep1"); ready(hostMember);
    applyCommand(room, guestMember, { type: "wt:presence", inPlayback: false }, isOnline);
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "ep2", fromItemId: "ep1", reason: "nextEp" }, isOnline);
    expect(wtAllReady(room)).toBe(false);
    arrive(hostMember, "ep2"); ready(hostMember);
    expect(wtAllReady(room)).toBe(true);
  });
});

describe("une proposition de saut arrivée trop tôt", () => {
  it("attend la porte, puis se rend une fois", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" }, isOnline);
    arrive(hostMember); ready(hostMember);
    const proposal = { segmentType: "Intro" as const, isEpisode: false, segmentStartTicks: 0, toTicks: 900_000_000 };
    deferSkip(room, { userId: host.userId, proposal });
    expect(takeDeferredSkip(room)).toBeNull();
    arrive(guestMember); ready(guestMember);
    expect(takeDeferredSkip(room)).toEqual({ userId: host.userId, proposal });
    expect(takeDeferredSkip(room)).toBeNull();
  });
});
