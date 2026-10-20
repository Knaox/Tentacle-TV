import { describe, expect, it } from "vitest";
import type { WtMemberDto, WtRoomStateDto } from "../types/watchTogether";
import { wtRoomAllReady, wtRoomAllReadyLocally, wtSkipHeld } from "./readyGate";

/**
 * « Tous prêts » avant tout saut de passage — le bug de l'intro : « Passer
 * l'intro » paraissait avant que tous les membres soient prêts.
 */

const member = (userId: string, patch: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId, username: userId, hasAvatar: false, online: true, inPlayback: true, buffering: false,
  playbackError: false, isHost: false, joinedAt: 0, ...patch,
});

const room = (patch: Partial<WtRoomStateDto> = {}): WtRoomStateDto => ({
  groupId: "g", hostUserId: "a", epoch: 1, itemId: "film", paused: false, positionTicks: 0,
  stateAtServerTime: 0, pauseReason: null, waitingForUserIds: [], members: [member("a"), member("b")], ...patch,
});

describe("wtSkipHeld — en séance, rien ne se saute avant « tous prêts »", () => {
  it("le serveur fait foi quand il le dit", () => {
    expect(wtSkipHeld(room({ allReady: false }), "film")).toBe(true);
    expect(wtSkipHeld(room({ allReady: true }), "film")).toBe(false);
    // Même si l'état semble prêt : un membre attendu n'est peut-être pas encore arrivé.
    expect(wtRoomAllReady(room({ allReady: false }))).toBe(false);
  });

  it("hors séance, ou sur un autre titre : rien n'est retenu", () => {
    expect(wtSkipHeld(null, "film")).toBe(false);
    expect(wtSkipHeld(room({ allReady: false }), "autre")).toBe(false);
    expect(wtSkipHeld(room({ allReady: false }), undefined)).toBe(false);
  });

  it("serveur d'avant : un membre qui charge, une barrière, une attente — retenu", () => {
    expect(wtSkipHeld(room(), "film")).toBe(false);
    expect(wtSkipHeld(room({ members: [member("a"), member("b", { buffering: true })] }), "film")).toBe(true);
    expect(wtSkipHeld(room({ members: [member("a"), member("b", { inPlayback: false })] }), "film")).toBe(true);
    expect(wtSkipHeld(room({ barrierId: 3 }), "film")).toBe(true);
    expect(wtSkipHeld(room({ waitingForUserIds: ["b"] }), "film")).toBe(true);
  });

  it("serveur d'avant : un membre hors ligne ou incapable de lire n'est pas attendu", () => {
    expect(wtRoomAllReadyLocally(room({ members: [member("a"), member("b", { online: false, inPlayback: false })] }))).toBe(true);
    expect(wtRoomAllReadyLocally(room({ members: [member("a"), member("b", { playbackError: true, inPlayback: false })] }))).toBe(true);
    expect(wtRoomAllReadyLocally(room({ itemId: null }))).toBe(false);
  });
});
