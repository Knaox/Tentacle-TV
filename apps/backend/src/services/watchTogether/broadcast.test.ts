/**
 * La projection Room → DTO, sur le seul point qui engage la compatibilité :
 * les réglages de l'hôte. Le champ est FACULTATIF — un client d'avant ne doit
 * pas le voir apparaître avec une valeur qu'il ne saurait pas lire.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../wsManager", () => ({
  isUserOnline: () => true,
  sendToUser: () => undefined,
}));

import { roomToDto } from "./broadcast";
import type { Room } from "./roomTypes";
import { DEFAULT_PLAYBACK_SETTINGS } from "../../playback/playbackSettings";

function makeRoom(hostSettings: Room["hostSettings"]): Room {
  return {
    groupId: "g-1",
    epoch: 3,
    hostUserId: "u-hote",
    hostSettings,
    contextItemId: null,
    itemId: "item-1",
    paused: false,
    positionTicks: 0,
    stateAtServerTime: 0,
    pauseReason: null,
    waitingFor: new Set(),
    waitingSince: new Map(),
    barrierId: 0,
    barrier: null,
    waitCause: null,
    pendingSkip: null,
    members: new Map([
      ["u-hote", {
        userId: "u-hote", username: "Hôte", hasAvatar: false, inPlayback: true,
        buffering: false, playbackError: false, joinedAt: 1, graceTimer: null,
        protocolVersion: 1, rttMs: null, driftMs: null, playbackSocket: null,
      }],
    ]),
    lastSeekAt: new Map(),
    chat: [],
    chatSeq: 0,
    lastChatAt: new Map(),
    lastReactionAt: new Map(),
    lastGifAt: new Map(),
    createdAt: 0,
  };
}

describe("roomToDto — les réglages de l'hôte", () => {
  it("les porte quand la salle les connaît", () => {
    const dto = roomToDto(makeRoom(DEFAULT_PLAYBACK_SETTINGS));
    expect(dto.hostPlaybackSettings).toEqual(DEFAULT_PLAYBACK_SETTINGS);
  });

  it("n'ajoute AUCUNE clé quand elle ne les connaît pas — compatibilité", () => {
    const dto = roomToDto(makeRoom(null));
    expect("hostPlaybackSettings" in dto).toBe(false);
  });
});

describe("roomToDto — les champs du protocole v2 sont facultatifs", () => {
  it("absents tant qu'ils ne disent rien (salle sans barrière, membre d'avant)", () => {
    const dto = roomToDto(makeRoom(null));
    expect("barrierId" in dto).toBe(false);
    expect("waitCause" in dto).toBe(false);
    expect("pendingSkip" in dto).toBe(false);
    const member = dto.members[0];
    expect("protocolVersion" in member).toBe(false);
    expect("rttMs" in member).toBe(false);
    expect("driftMs" in member).toBe(false);
  });

  it("présents dès qu'ils disent quelque chose", () => {
    const room = makeRoom(null);
    room.barrierId = 3;
    room.barrier = { id: 3, targetTicks: 900, cause: "seek", openedAt: 0, resumeOnRelease: true, timer: null };
    room.waitingFor.add("u-hote");
    room.waitCause = "seek";
    room.pendingSkip = { segmentType: "Intro", segmentStartTicks: 10, toTicks: 900, skipAtPositionTicks: 60, byUserId: "u-hote" };
    const m = room.members.get("u-hote")!;
    m.protocolVersion = 2; m.rttMs = 42; m.driftMs = -12;
    const dto = roomToDto(room);
    expect(dto.barrierId).toBe(3);
    expect(dto.waitCause).toBe("seek");
    expect(dto.pendingSkip).toEqual(room.pendingSkip);
    expect(dto.members[0]).toMatchObject({ protocolVersion: 2, rttMs: 42, driftMs: -12 });
  });

  it("une barrière libérée n'est plus annoncée, même si le compteur a tourné", () => {
    const room = makeRoom(null);
    room.barrierId = 3;
    expect("barrierId" in roomToDto(room)).toBe(false);
  });
});
