import { describe, expect, it } from "vitest";
import type { WtRoomStateDto } from "../types/watchTogether";
import { isBarrierParticipant, isGroupSessionActive, isWaitedForMe } from "./sessionRules";

const room = { groupId: "g", itemId: "item" } as WtRoomStateDto;

describe("isGroupSessionActive — une séance exige une salle réelle", () => {
  it("vrai avec le drapeau, une salle et un média", () => {
    expect(isGroupSessionActive(true, room, "item")).toBe(true);
  });

  it("faux sans salle, même drapeau levé (shim webOS : isInGroup à vrai sans Watch Together)", () => {
    expect(isGroupSessionActive(true, null, "item")).toBe(false);
    expect(isGroupSessionActive(true, undefined, "item")).toBe(false);
  });

  it("faux hors groupe ou sans média", () => {
    expect(isGroupSessionActive(false, room, "item")).toBe(false);
    expect(isGroupSessionActive(true, room, undefined)).toBe(false);
  });
});

describe("isWaitedForMe / isBarrierParticipant — ce que la salle attend de moi", () => {
  const waiting = { paused: true, pauseReason: "buffering", waitingForUserIds: ["moi"] } as unknown as WtRoomStateDto;

  it("je suis attendu quand la salle bufferise pour moi", () => {
    expect(isWaitedForMe(waiting, "moi")).toBe(true);
    expect(isWaitedForMe(waiting, "autre")).toBe(false);
    expect(isWaitedForMe({ ...waiting, pauseReason: "user" }, "moi")).toBe(false);
    expect(isWaitedForMe(null, "moi")).toBe(false);
  });

  it("participant d'une barrière seulement quand elle existe et m'attend", () => {
    expect(isBarrierParticipant({ ...waiting, barrierId: 4 }, "moi")).toBe(true);
    expect(isBarrierParticipant(waiting, "moi")).toBe(false);
    expect(isBarrierParticipant({ ...waiting, barrierId: 4 }, null)).toBe(false);
  });
});
