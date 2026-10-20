import { describe, expect, it } from "vitest";
import type { WtInvitableUserDto, WtRoomStateDto } from "../../types/watchTogether";
import { inviteCandidates, toggleSelection } from "./inviteModel";

const user = (id: string, name: string, isOnline = false): WtInvitableUserDto => ({ id, name, hasAvatar: false, isOnline });
const room = { members: [{ userId: "me" }] } as unknown as WtRoomStateDto;
const users = [user("me", "Moi", true), user("z", "Zoé"), user("a", "Alix"), user("o", "Olga", true)];

describe("inviteCandidates", () => {
  it("écarte le groupe, met les personnes en ligne d'abord, puis par nom", () => {
    expect(inviteCandidates(users, room, new Set(), "").map((c) => c.user.id)).toEqual(["o", "a", "z"]);
  });

  it("filtre par la recherche, sans tenir aux accents", () => {
    expect(inviteCandidates(users, room, new Set(), "zoe").map((c) => c.user.id)).toEqual(["z"]);
  });

  it("garde une personne déjà invitée, marquée", () => {
    expect(inviteCandidates(users, room, new Set(["a"]), "").find((c) => c.user.id === "a")?.invited).toBe(true);
  });
});

describe("toggleSelection", () => {
  it("coche, décoche, et ignore une personne déjà invitée", () => {
    const alix = { user: users[2]!, invited: false };
    const once = toggleSelection(new Map(), alix);
    expect([...once.keys()]).toEqual(["a"]);
    expect(toggleSelection(once, alix).size).toBe(0);
    expect(toggleSelection(new Map(), { ...alix, invited: true }).size).toBe(0);
  });
});
