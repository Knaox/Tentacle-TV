/**
 * Le saut de passage armé par le serveur : proposé par n'importe quel lecteur,
 * réglé par les réglages de l'HÔTE, compté en position de média (une pause le
 * fige), dédupliqué par passage, annulé par une croix ou un seek, redemandé
 * après un rembobinage, exécuté par une barrière.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const online = new Set<string>();
vi.mock("../wsManager", () => ({
  isUserOnline: (userId: string) => online.has(userId),
  sendToUser: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { applyCommand } from "./sync";
import { cancelPendingSkip, onSkipExecuted, proposeSkip } from "./syncSkip";
import { TICKS_PER_MS } from "./protocol";
import { DEFAULT_PLAYBACK_SETTINGS } from "../../playback/playbackSettings";
import type { Room, RoomMember } from "./roomTypes";

const NOW = 1_700_000_000_000;
const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const isOnline = (userId: string) => online.has(userId);
const S = (seconds: number) => seconds * 1_000 * TICKS_PER_MS;
const intro = { segmentType: "Intro" as const, isEpisode: true, segmentStartTicks: S(60), toTicks: S(150) };

let room: Room;
let hostMember: RoomMember;
let guestMember: RoomMember;
const executed = vi.fn();

beforeAll(() => { vi.useFakeTimers(); onSkipExecuted(executed); });
beforeEach(() => {
  vi.setSystemTime(NOW);
  executed.mockClear();
  online.clear(); online.add(host.userId); online.add(guest.userId);
  room = createRoom(host, null)!;
  addMember(room, guest);
  room.itemId = "item";
  hostMember = room.members.get(host.userId)!;
  guestMember = room.members.get(guest.userId)!;
  for (const m of [hostMember, guestMember]) { m.inPlayback = true; m.protocolVersion = 2; }
  // L'hôte saute les intros après 3 s ; la salle joue, à 62 s.
  room.hostSettings = { ...DEFAULT_PLAYBACK_SETTINGS, intro: { action: "auto", countdownVisible: true, autoDelayMs: 3_000 } };
  room.paused = false; room.pauseReason = null; room.positionTicks = S(62); room.stateAtServerTime = NOW;
});
afterEach(() => { removeMember(guest.userId); removeMember(host.userId); vi.clearAllTimers(); });

describe("proposeSkip", () => {
  it("arme UN décompte, en position de média, depuis la position de la salle", () => {
    expect(proposeSkip(room, guestMember, intro, NOW)).toBe(true);
    expect(room.pendingSkip).toMatchObject({ segmentType: "Intro", toTicks: S(150), skipAtPositionTicks: S(65), byUserId: guest.userId });
    expect(proposeSkip(room, hostMember, intro, NOW + 10)).toBe(false); // déjà armé
  });

  it("suit les réglages de l'hôte : un passage en « bouton » ou « off » ne s'arme pas", () => {
    room.hostSettings = { ...DEFAULT_PLAYBACK_SETTINGS, intro: { ...DEFAULT_PLAYBACK_SETTINGS.intro, action: "button" } };
    expect(proposeSkip(room, guestMember, intro, NOW)).toBe(false);
  });

  it("sans réglages en base, les défauts de l'hôte gouvernent", () => {
    room.hostSettings = null; // intro auto par défaut, 5 s
    expect(proposeSkip(room, guestMember, intro, NOW)).toBe(true);
    expect(room.pendingSkip?.skipAtPositionTicks).toBe(S(67));
  });

  it("refuse une proposition hors du passage", () => {
    room.positionTicks = S(200);
    expect(proposeSkip(room, guestMember, intro, NOW)).toBe(false);
  });
});

describe("le décompte", () => {
  it("s'exécute à l'échéance par une barrière de saut, et le passage est réglé", () => {
    proposeSkip(room, guestMember, intro, NOW);
    vi.advanceTimersByTime(2_900);
    expect(executed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(executed).toHaveBeenCalledTimes(1);
    expect(room.pendingSkip).toBeNull();
    expect(room.barrier?.cause).toBe("skip");
    expect(room.positionTicks).toBe(S(150));
    expect(proposeSkip(room, hostMember, intro, Date.now())).toBe(false); // réglé
  });

  it("se fige pendant une pause et reprend avec la lecture", () => {
    proposeSkip(room, guestMember, intro, NOW);
    vi.advanceTimersByTime(1_000);
    applyCommand(room, hostMember, { type: "wt:pause", positionTicks: S(63) }, isOnline);
    vi.advanceTimersByTime(10_000);
    expect(executed).not.toHaveBeenCalled();
    applyCommand(room, hostMember, { type: "wt:play", positionTicks: S(63) }, isOnline);
    // Reprise planifiée : la position ne court qu'après le délai de reprise.
    vi.advanceTimersByTime(room.stateAtServerTime - Date.now() + 2_000 + 100);
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it("une croix l'annule et règle le passage ; un rembobinage le redemande", () => {
    proposeSkip(room, guestMember, intro, NOW);
    expect(cancelPendingSkip(room, true)).toBe(true);
    expect(room.pendingSkip).toBeNull();
    expect(proposeSkip(room, hostMember, intro, NOW)).toBe(false);
    applyCommand(room, hostMember, { type: "wt:seek", positionTicks: S(30) }, isOnline);
    room.positionTicks = S(61);
    expect(proposeSkip(room, hostMember, intro, Date.now())).toBe(true);
  });

  it("un seek (un clic « passer » en est un) l'annule", () => {
    proposeSkip(room, guestMember, intro, NOW);
    applyCommand(room, guestMember, { type: "wt:seek", positionTicks: S(150) }, isOnline);
    expect(room.pendingSkip).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(executed).not.toHaveBeenCalled();
  });

  it("un changement de média efface tout", () => {
    proposeSkip(room, guestMember, intro, NOW);
    applyCommand(room, hostMember, { type: "wt:setItem", itemId: "next", fromItemId: "item", reason: "nextEp" }, isOnline);
    expect(room.pendingSkip).toBeNull();
    expect(room.skipHistory.size).toBe(0);
  });
});
