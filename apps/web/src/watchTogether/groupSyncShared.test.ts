import { describe, expect, it } from "vitest";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import { isGroupSessionActive } from "./groupSyncShared";

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
