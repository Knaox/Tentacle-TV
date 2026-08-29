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
import type { Room } from "./roomStore";
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
    members: new Map([
      ["u-hote", {
        userId: "u-hote", username: "Hôte", hasAvatar: false, inPlayback: true,
        buffering: false, playbackError: false, joinedAt: 1, graceTimer: null,
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
