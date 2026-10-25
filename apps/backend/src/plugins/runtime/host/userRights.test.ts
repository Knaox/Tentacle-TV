/**
 * `users.rights` → `keepOffline` (capacité `offline.music`) : garder hors ligne
 * ce qu'une extension sert suit le droit Jellyfin du compte, jamais pour un
 * invité de la Famille, jamais sans l'usage de l'extension.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  guest: null as null | "denied" | { accountName: string | null },
}));

vi.mock("../../../services/jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async () => ({ ok: true, status: 200, data: { Id: "u1", Policy: state.policy } }),
}));
vi.mock("../../../services/family/familyGuestExtensions", () => ({ guestExtensionAccess: async () => state.guest }));
vi.mock("../../../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => state.guest !== null }));
vi.mock("../../../services/pluginManager", () => ({ getInstalled: () => [{ pluginId: "musique", config: { enabled: true } }] }));
vi.mock("../../../services/pluginStorage/gate", () => ({ isPluginUsable: () => true }));
vi.mock("../hostServices", () => ({ runtimeServices: () => ({ jellyfin: { musicLibrary: async () => ({ libraryId: "lib" }) } }) }));

import { userRights } from "./userRights";

beforeEach(() => {
  state.policy = { EnableAllFolders: true, EnableContentDownloading: true };
  state.guest = null;
});

describe("users.rights → keepOffline", () => {
  it("le droit Jellyfin de garder du compte", async () => {
    expect(await userRights("musique", "u1")).toMatchObject({ canUse: true, keepOffline: true });
    state.policy = { EnableAllFolders: true, EnableContentDownloading: false };
    expect(await userRights("musique", "u1")).toMatchObject({ canUse: true, keepOffline: false });
  });

  it("un invité de la Famille ne garde jamais rien, même avec « peut demander »", async () => {
    state.guest = { accountName: "invite" };
    expect(await userRights("musique", "u1")).toMatchObject({ canUse: true, keepOffline: false });
  });

  it("sans l'usage de l'extension, pas de hors ligne", async () => {
    state.policy = { EnableAllFolders: false, EnabledFolders: [], EnableContentDownloading: true };
    expect(await userRights("musique", "u1")).toMatchObject({ canUse: false, keepOffline: false });
  });
});
