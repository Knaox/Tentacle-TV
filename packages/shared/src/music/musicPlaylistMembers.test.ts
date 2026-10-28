import { describe, expect, it } from "vitest";
import {
  canAddToPlaylist,
  canRemoveFromPlaylist,
  isSharedPlaylist,
  memberRightAllows,
  parseMemberRight,
  playlistPeople,
  type MusicPlaylistSharing,
} from "./musicPlaylistMembers";

const owner = { userId: "aaaa", name: "Knaoxtest", imageTag: null };
const sharing = (right: MusicPlaylistSharing["right"], role: MusicPlaylistSharing["role"] = "member"): MusicPlaylistSharing => ({
  role,
  right,
  owner,
  members: [{ userId: "bbbb", name: "Knaoxtest2", imageTag: "t", right: right === "owner" ? "read" : right }],
});

describe("droits d'une playlist partagée", () => {
  it("chaque droit contient les précédents", () => {
    expect(memberRightAllows("read", "add")).toBe(false);
    expect(memberRightAllows("add", "add")).toBe(true);
    expect(memberRightAllows("add", "remove")).toBe(false);
    expect(memberRightAllows("remove", "add")).toBe(true);
    expect(memberRightAllows("remove", "remove")).toBe(true);
    expect(memberRightAllows("owner", "remove")).toBe(true);
  });

  it("un droit inconnu est refusé", () => {
    expect(parseMemberRight("add")).toBe("add");
    expect(parseMemberRight("owner")).toBeNull();
    expect(parseMemberRight(3)).toBeNull();
  });

  it("ajouter et retirer suivent le droit du membre ; le propriétaire (editable) peut tout", () => {
    expect(canAddToPlaylist({ editable: false, sharing: sharing("read") })).toBe(false);
    expect(canAddToPlaylist({ editable: false, sharing: sharing("add") })).toBe(true);
    expect(canRemoveFromPlaylist({ editable: false, sharing: sharing("add") })).toBe(false);
    expect(canRemoveFromPlaylist({ editable: false, sharing: sharing("remove") })).toBe(true);
    expect(canAddToPlaylist({ editable: true })).toBe(true);
    expect(canRemoveFromPlaylist({ editable: false })).toBe(false);
  });

  it("partagée : un membre au moins, ou le compte en est membre", () => {
    expect(isSharedPlaylist({ editable: true })).toBe(false);
    expect(isSharedPlaylist({ editable: true, sharing: { ...sharing("owner", "owner"), members: [] } })).toBe(false);
    expect(isSharedPlaylist({ editable: true, sharing: sharing("owner", "owner") })).toBe(true);
    expect(isSharedPlaylist({ editable: false, sharing: sharing("read") })).toBe(true);
  });

  it("la pile d'avatars : propriétaire en tête, sans le compte qui lit", () => {
    expect(playlistPeople(sharing("read"), "BBBB").map((p) => p.name)).toEqual(["Knaoxtest"]);
    expect(playlistPeople(sharing("owner", "owner"), "aa-aa").map((p) => p.name)).toEqual(["Knaoxtest2"]);
  });
});
