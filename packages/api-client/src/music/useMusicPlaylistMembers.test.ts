/** Ce qu'une playlist permet au compte, partage compris — et RIEN du partage face à un serveur qui ne le déclare pas. */

import { describe, expect, it } from "vitest";
import type { MusicPlaylist, MusicPlaylistSharing } from "@tentacle-tv/shared/music";
import { playlistSharingRules } from "./useMusicPlaylistMembers";

const ME = "b".repeat(32);
const sharing: MusicPlaylistSharing = {
  role: "member",
  right: "add",
  owner: { userId: "a".repeat(32), name: "Knaoxtest", imageTag: null },
  members: [{ userId: ME, name: "Knaoxtest2", imageTag: null, right: "add" }],
};
const playlist = (extra: Partial<MusicPlaylist> = {}): Pick<MusicPlaylist, "editable" | "sharing"> => ({ editable: false, sharing, ...extra });

describe("ce qu'une playlist partagée permet", () => {
  it("un membre « ajouter » : ajoute, ne retire pas ; il voit le propriétaire, jamais lui-même", () => {
    const rules = playlistSharingRules(playlist(), true, ME);
    expect(rules).toMatchObject({ isShared: true, isMember: true, canAdd: true, canRemove: false });
    expect(rules.people.map((p) => p.name)).toEqual(["Knaoxtest"]);
  });

  it("serveur sans la capacité : rien du partage — ni badge, ni personne, ni droit de membre", () => {
    const rules = playlistSharingRules(playlist(), false, ME);
    expect(rules).toMatchObject({ isShared: false, isMember: false, canAdd: false, canRemove: false, sharing: null, people: [] });
  });

  it("ma playlist sans membre : la règle d'avant", () => {
    expect(playlistSharingRules({ editable: true }, true, "a".repeat(32))).toMatchObject({ isShared: false, canAdd: true, canRemove: true });
  });
});
