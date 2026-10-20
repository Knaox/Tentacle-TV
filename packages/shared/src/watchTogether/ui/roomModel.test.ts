import { describe, expect, it } from "vitest";
import type { WtMemberDto, WtRoomStateDto } from "../../types/watchTogether";
import { memberState, roomMemberRows, waitingNotice } from "./roomModel";

const member = (userId: string, over: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId, username: userId.toUpperCase(), hasAvatar: false, online: true, inPlayback: false,
  buffering: false, playbackError: false, isHost: false, joinedAt: 0, ...over,
});

const room = (members: WtMemberDto[], over: Partial<WtRoomStateDto> = {}): WtRoomStateDto => ({
  groupId: "g", hostUserId: members.find((m) => m.isHost)?.userId ?? "h", epoch: 1, itemId: "i",
  paused: false, positionTicks: 0, stateAtServerTime: 0, pauseReason: null, waitingForUserIds: [],
  members, ...over,
});

describe("memberState", () => {
  it("dit l'état le plus utile d'abord", () => {
    expect(memberState(member("a", { online: false, playbackError: true }))).toBe("offline");
    expect(memberState(member("a", { playbackError: true, buffering: true }))).toBe("error");
    expect(memberState(member("a", { buffering: true, inPlayback: true }))).toBe("buffering");
    expect(memberState(member("a", { inPlayback: true }))).toBe("watching");
    expect(memberState(member("a"))).toBe("online");
  });
});

describe("roomMemberRows", () => {
  const r = room([
    member("c", { joinedAt: 3 }),
    member("me", { joinedAt: 4 }),
    member("h", { isHost: true, joinedAt: 1 }),
    member("b", { joinedAt: 2 }),
  ]);

  it("range l'hôte, soi, puis les autres par arrivée", () => {
    expect(roomMemberRows(r, "me").map((x) => x.member.userId)).toEqual(["h", "me", "b", "c"]);
  });

  it("seul l'hôte expulse, jamais lui-même", () => {
    expect(roomMemberRows(r, "me").some((x) => x.canKick)).toBe(false);
    const asHost = roomMemberRows(r, "h");
    expect(asHost.find((x) => x.isSelf)?.canKick).toBe(false);
    expect(asHost.filter((x) => x.canKick).map((x) => x.member.userId)).toEqual(["b", "c", "me"]);
  });
});

describe("waitingNotice", () => {
  const members = [member("me"), member("a"), member("b")];
  const wait = { paused: true, pauseReason: "buffering" as const };
  it("rien quand la salle n'attend personne d'autre", () => {
    expect(waitingNotice(room(members), "me")).toBeNull();
    expect(waitingNotice(null, "me")).toBeNull();
    expect(waitingNotice(room(members, { ...wait, waitingForUserIds: ["me"] }), "me")).toBeNull();
  });
  it("nomme le seul membre attendu, compte les autres", () => {
    expect(waitingNotice(room(members, { ...wait, waitingForUserIds: ["a"] }), "me"))
      .toEqual({ key: "memberBuffering", params: { name: "A" } });
    expect(waitingNotice(room(members, { ...wait, waitingForUserIds: ["a", "b", "me"] }), "me"))
      .toEqual({ key: "membersBuffering", params: { count: 2 } });
  });
  it("dit « Synchronisation… » pour une barrière, même en pause utilisateur", () => {
    expect(waitingNotice(room(members, { paused: true, pauseReason: "user", waitCause: "seek", waitingForUserIds: ["a"] }), "me"))
      .toEqual({ key: "syncing" });
  });
});
