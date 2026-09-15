/**
 * La barrière « tous posés » : un seek met la salle en attente sur sa cible,
 * chaque lecteur v2 confirme, le dernier déclenche la reprise planifiée. Un
 * client d'avant n'est jamais attendu ; un « prêt » périmé ne libère rien ;
 * un nouveau seek remplace l'attente ; une reprise demandée pendant l'attente
 * n'a lieu qu'à la libération ; les retardataires sont lâchés sans échec.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const online = new Set<string>();
vi.mock("../wsManager", () => ({
  isUserOnline: (userId: string) => online.has(userId),
  sendToUser: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { applyCommand, releaseMemberWait } from "./sync";
import { onBarrierExpired } from "./syncBarrier";
import { TICKS_PER_MS, WT_BARRIER_TIMEOUT_MS } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

const NOW = 1_700_000_000_000;
const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const legacy = { userId: "u-ancien", username: "Ancien", hasAvatar: false };
const isOnline = (userId: string) => online.has(userId);
const S = (seconds: number) => seconds * 1_000 * TICKS_PER_MS;

let room: Room;
let hostMember: RoomMember;
let guestMember: RoomMember;
let legacyMember: RoomMember;

beforeAll(() => { vi.useFakeTimers(); });
beforeEach(() => {
  vi.setSystemTime(NOW);
  online.clear();
  for (const u of [host, guest, legacy]) online.add(u.userId);
  room = createRoom(host, null)!;
  addMember(room, guest);
  addMember(room, legacy);
  room.itemId = "item";
  hostMember = room.members.get(host.userId)!;
  guestMember = room.members.get(guest.userId)!;
  legacyMember = room.members.get(legacy.userId)!;
  for (const m of [hostMember, guestMember, legacyMember]) { m.inPlayback = true; m.protocolVersion = 2; }
  legacyMember.protocolVersion = 1;
  // Salle en lecture depuis 100 s.
  room.paused = false; room.pauseReason = null; room.positionTicks = S(100); room.stateAtServerTime = NOW;
});
afterEach(() => {
  for (const u of [legacy, guest, host]) removeMember(u.userId);
  vi.clearAllTimers();
});

describe("wt:seek en lecture", () => {
  it("ouvre une barrière sur la cible, attendue par les seuls lecteurs v2", () => {
    const out = applyCommand(room, guestMember, { type: "wt:seek", positionTicks: S(500) }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "seek" });
    expect(room.paused).toBe(true);
    expect(room.pauseReason).toBe("buffering");
    expect(room.waitCause).toBe("seek");
    expect(room.positionTicks).toBe(S(500));
    expect(room.barrier?.id).toBe(1);
    expect([...room.waitingFor].sort()).toEqual([guest.userId, host.userId].sort());
  });

  it("le dernier posé déclenche la reprise planifiée depuis la cible", () => {
    applyCommand(room, guestMember, { type: "wt:seek", positionTicks: S(500) }, isOnline);
    const first = applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    expect(first).toEqual({ kind: "broadcast", cause: "presence" });
    expect(room.paused).toBe(true);
    vi.setSystemTime(NOW + 300);
    const last = applyCommand(room, hostMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    expect(last).toEqual({ kind: "broadcast", cause: "schedule" });
    expect(room.paused).toBe(false);
    expect(room.barrier).toBeNull();
    expect(room.positionTicks).toBe(S(500));
    expect(room.stateAtServerTime).toBeGreaterThan(NOW + 300);
  });

  it("un « prêt » d'une barrière périmée ne libère rien ; sans identifiant, il compte", () => {
    applyCommand(room, guestMember, { type: "wt:seek", positionTicks: S(500) }, isOnline);
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(600) }, isOnline);
    expect(room.barrier?.id).toBe(2);
    expect(room.waitingFor.size).toBe(2); // remplacée : tout le monde re-confirme
    expect(applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline))
      .toEqual({ kind: "ignore" });
    expect(room.waitingFor.size).toBe(2);
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: false }, isOnline);
    applyCommand(room, hostMember, { type: "wt:buffering", buffering: false, barrierId: 2 }, isOnline);
    expect(room.paused).toBe(false);
    expect(room.positionTicks).toBe(S(600));
  });

  it("une salle de clients d'avant ne gèle pas : seek appliqué, reprise planifiée aussitôt", () => {
    hostMember.protocolVersion = 1; guestMember.protocolVersion = 1;
    applyCommand(room, legacyMember, { type: "wt:seek", positionTicks: S(42) }, isOnline);
    expect(room.paused).toBe(false);
    expect(room.barrier).toBeNull();
    expect(room.positionTicks).toBe(S(42));
    expect(room.stateAtServerTime).toBeGreaterThan(NOW);
  });

  it("les retardataires sont lâchés au délai, sans échec, et la salle repart", () => {
    const expired = vi.fn();
    onBarrierExpired(expired);
    applyCommand(room, guestMember, { type: "wt:seek", positionTicks: S(500) }, isOnline);
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    vi.advanceTimersByTime(WT_BARRIER_TIMEOUT_MS + 5);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(room.paused).toBe(false);
    expect(room.barrier).toBeNull();
    expect(hostMember.playbackError).toBe(false);
    expect(hostMember.inPlayback).toBe(true);
  });
});

describe("wt:seek en pause utilisateur", () => {
  beforeEach(() => { room.paused = true; room.pauseReason = "user"; });

  it("chacun se cale, la salle reste en pause une fois tous posés", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(300) }, isOnline);
    expect(room.paused).toBe(true);
    expect(room.pauseReason).toBe("user");
    expect(room.waitCause).toBe("seek");
    applyCommand(room, hostMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    const out = applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "presence" });
    expect(room.paused).toBe(true);
    expect(room.barrier).toBeNull();
    expect(room.waitCause).toBeNull();
  });

  it("une lecture demandée pendant l'attente n'a lieu qu'à la libération", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(300) }, isOnline);
    const play = applyCommand(room, hostMember, { type: "wt:play", positionTicks: S(300) }, isOnline);
    expect(play).toEqual({ kind: "broadcast", cause: "play" });
    expect(room.paused).toBe(true);
    expect(room.waitCause).toBe("play");
    expect(room.waitingFor.has(guest.userId)).toBe(true);
    const last = applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    expect(last).toEqual({ kind: "broadcast", cause: "schedule" });
    expect(room.paused).toBe(false);
  });

  it("une pause pendant l'attente annule la reprise à la libération", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(300) }, isOnline);
    applyCommand(room, hostMember, { type: "wt:play", positionTicks: S(300) }, isOnline);
    applyCommand(room, guestMember, { type: "wt:pause", positionTicks: S(300) }, isOnline);
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: false, barrierId: 1 }, isOnline);
    expect(room.paused).toBe(true);
    expect(room.pauseReason).toBe("user");
  });

  it("`force` passe outre l'attente", () => {
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(300) }, isOnline);
    applyCommand(room, hostMember, { type: "wt:play", positionTicks: S(300), force: true }, isOnline);
    expect(room.paused).toBe(false);
    expect(room.barrier).toBeNull();
  });
});

describe("un lecteur qui bufferise", () => {
  it("gèle la salle à sa position et la libère seul, sans attendre les autres", () => {
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: true, positionTicks: S(100.5) }, isOnline);
    expect(room.paused).toBe(true);
    expect(room.waitCause).toBe("buffering");
    expect([...room.waitingFor]).toEqual([guest.userId]);
    expect(room.barrier?.timer).toBeNull(); // chargement : pas de délai court
    const out = applyCommand(room, guestMember, { type: "wt:buffering", buffering: false }, isOnline);
    expect(out).toEqual({ kind: "broadcast", cause: "schedule" });
    expect(room.positionTicks).toBe(S(100.5));
  });

  it("son socket de lecture fermé : la salle ne l'attend plus", () => {
    applyCommand(room, guestMember, { type: "wt:buffering", buffering: true, positionTicks: S(100.5) }, isOnline);
    const resumed = releaseMemberWait(room, guestMember);
    expect(resumed).toBe(true);
    expect(room.paused).toBe(false);
    expect(guestMember.inPlayback).toBe(false);
  });
});

describe("wt:setItem", () => {
  it("attend tous les lecteurs en cours, toutes versions confondues", () => {
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "next", fromItemId: "item", reason: "nextEp" }, isOnline);
    expect(room.paused).toBe(true);
    expect(room.barrier?.cause).toBe("buffering");
    expect([...room.waitingFor].sort()).toEqual([guest.userId, host.userId, legacy.userId].sort());
    expect(room.positionTicks).toBe(0);
  });
});
