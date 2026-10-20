import { describe, expect, it } from "vitest";
import type { WtMemberDto, WtRoomStateDto } from "../types/watchTogether";
import { wtPlayerAligned, wtRoomAllReady, wtRoomAllReadyLocally, wtSkipHeld } from "./readyGate";

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

describe("wtSkipHeld — un ARRIVANT n'est jamais prêt (ajout de Damien du 20/10)", () => {
  it("du clic à son premier « prêt » : retenu chez tous, même si le serveur dit « prêt »", () => {
    const arriving = room({ allReady: true, arrivingUserIds: ["b"] });
    expect(wtRoomAllReady(arriving)).toBe(false);
    expect(wtSkipHeld(arriving, "film")).toBe(true);
    // Arrivé : tout revient.
    expect(wtSkipHeld(room({ allReady: true }), "film")).toBe(false);
  });

  it("serveur d'avant (sans `allReady`) : un membre qui n'est pas encore en lecture retient aussi", () => {
    expect(wtSkipHeld(room({ members: [member("a"), member("b", { inPlayback: false })] }), "film")).toBe(true);
  });
});

describe("wtPlayerAligned — les passages se taisent tant que le lecteur n'est pas là où est la salle", () => {
  it("l'arrivant ouvert à 0 s, la salle gelée à 272 s : pas aligné ; posé : aligné", () => {
    const frozen = room({ paused: true, positionTicks: 272 * 10_000_000 });
    expect(wtPlayerAligned(frozen, 0, 0)).toBe(false);
    expect(wtPlayerAligned(frozen, 0, 272.05)).toBe(true);
  });

  it("en lecture, une dérive ordinaire reste alignée ; un saut en vol, non", () => {
    const playing = room({ paused: false, positionTicks: 30 * 10_000_000, stateAtServerTime: 0 });
    expect(wtPlayerAligned(playing, 10_000, 40.3)).toBe(true);
    expect(wtPlayerAligned(playing, 10_000, 70)).toBe(false);
  });
});
