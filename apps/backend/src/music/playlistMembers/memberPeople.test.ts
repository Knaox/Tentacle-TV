/** Les personnes d'une playlist partagée : nom et photo seulement, un compte désactivé ou disparu n'y paraît pas. */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/watchTogether/usersCache", () => ({ getJellyfinUsers: async () => [] }));
vi.mock("../../services/family/familyGuestMarkers", () => ({ withoutFamilyGuests: async <T>(items: T[]) => items }));
vi.mock("../../services/octaveRights/octaveAccess", () => ({ hasOctaveAccess: async () => true }));

import { sharingOf, type PeopleIndex } from "./memberPeople";
import type { MemberRow } from "./memberStore";

const user = (id: string, name: string, extra: Partial<{ isDisabled: boolean; hasAvatar: boolean; imageTag: string | null }> = {}) => ({
  id,
  name,
  hasAvatar: false,
  isDisabled: false,
  isAdministrator: false,
  isHidden: false,
  imageTag: null,
  syncPlayAccess: null,
  ...extra,
});
const index: PeopleIndex = new Map([
  ["a".repeat(32), user("a".repeat(32), "Knaoxtest", { hasAvatar: true, imageTag: "tag" })],
  ["b".repeat(32), user("b".repeat(32), "Knaoxtest2")],
  ["c".repeat(32), user("c".repeat(32), "Ancien", { isDisabled: true })],
]);
const row = (memberId: string, right: MemberRow["right"]): MemberRow => ({ playlistId: "p", memberId, ownerUserId: "a".repeat(32), right, createdAt: 0 });

describe("le partage tel qu'on le montre", () => {
  it("le propriétaire sans membre : rien (la playlist n'est pas partagée), sauf sa feuille de partage", () => {
    expect(sharingOf({ right: "owner", readerId: "a".repeat(32) }, [], index)).toBeUndefined();
    expect(sharingOf({ right: "owner", readerId: "a".repeat(32) }, [], index, { evenUnshared: true })?.members).toEqual([]);
  });

  it("un membre voit le propriétaire et les autres ; un compte désactivé ou disparu n'y est pas", () => {
    const shown = sharingOf({ right: "add", readerId: "a".repeat(32) }, [row("b".repeat(32), "add"), row("c".repeat(32), "read"), row("9".repeat(32), "read")], index);
    expect(shown?.role).toBe("member");
    expect(shown?.right).toBe("add");
    expect(shown?.owner).toEqual({ userId: "a".repeat(32), name: "Knaoxtest", imageTag: "tag" });
    expect(shown?.members).toEqual([{ userId: "b".repeat(32), name: "Knaoxtest2", imageTag: null, right: "add" }]);
  });

  it("un compte sans droit (playlist publique de Jellyfin) : rien", () => {
    expect(sharingOf({ right: null, readerId: "a".repeat(32) }, [row("b".repeat(32), "add")], index)).toBeUndefined();
  });
});
