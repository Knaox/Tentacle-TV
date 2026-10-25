/**
 * `users.list` : les comptes que l'hôte donne à une extension pour régler ses droits par compte — Jellyfin fait
 * foi, ni désactivés, ni invités de la Famille ; une base muette ne rend pas de liste (un invité ne doit jamais
 * y paraître).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  down: false,
  familyDown: false,
  guests: new Set<string>(),
  users: [] as { Id?: string; Name?: string; Policy?: Record<string, unknown> }[],
}));

vi.mock("../../../services/jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string) =>
    state.down || path !== "/Users" ? { ok: false, status: 503, failure: "unreachable" } : { ok: true, data: state.users },
}));
vi.mock("../../../services/family/familyGuestMarkers", () => ({
  withoutFamilyGuests: async <T>(items: T[], idOf: (item: T) => string) => {
    if (state.familyDown) throw new Error("base muette");
    return items.filter((item) => !state.guests.has(idOf(item)));
  },
}));

const { userList } = await import("./userList");

describe("users.list", () => {
  beforeEach(() => {
    state.down = false;
    state.familyDown = false;
    state.guests = new Set(["g1"]);
    state.users = [
      { Id: "b2", Name: "Bruno", Policy: { IsAdministrator: false } },
      { Id: "a1", Name: "Alice", Policy: { IsAdministrator: true } },
      { Id: "g1", Name: "Invité", Policy: {} },
      { Id: "d4", Name: "Désactivé", Policy: { IsDisabled: true } },
      { Name: "Sans identifiant" },
    ];
  });

  it("rend les comptes actifs, triés par nom, sans invité ni compte désactivé", async () => {
    expect(await userList()).toEqual([
      { userId: "a1", name: "Alice", isAdmin: true },
      { userId: "b2", name: "Bruno", isAdmin: false },
    ]);
  });

  it("Jellyfin muet ou Famille illisible : un refus, jamais une liste qui pourrait montrer un invité", async () => {
    state.down = true;
    await expect(userList()).rejects.toMatchObject({ code: "unavailable" });
    state.down = false;
    state.familyDown = true;
    await expect(userList()).rejects.toMatchObject({ code: "unavailable" });
  });
});
