/**
 * `users.rights` de l'hôte : « Accès à Octave » coupé, l'extension de musique
 * n'est plus permise au compte (`canUse` faux) — donc ni `/api/plugins/active`,
 * ni son relais (`mayUseIsolatedPlugin`), ni ses propres gardes ne la lui offrent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const LIB = "f137a2dd21bbc1b99aa5c0f6bf02a805";

const state = vi.hoisted(() => ({ octave: true }));

vi.mock("../../../services/jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async () => ({ ok: true, data: { Id: USER, Policy: { IsDisabled: false, EnableAllFolders: true } } }),
}));
vi.mock("../../../services/family/familyGuestExtensions", () => ({ guestExtensionAccess: async () => null }));
vi.mock("../../../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => false }));
vi.mock("../../../services/pluginManager", () => ({ getInstalled: () => [{ pluginId: "musique", config: { enabled: true } }] }));
vi.mock("../../../services/pluginStorage/gate", () => ({ isPluginUsable: () => true }));
vi.mock("../hostServices", () => ({ runtimeServices: () => ({ jellyfin: { musicLibrary: async () => ({ libraryId: LIB }) } }) }));
vi.mock("../../../services/octaveRights/octaveAccess", () => ({ hasOctaveAccess: async () => state.octave }));

import { userRights } from "./userRights";

beforeEach(() => {
  state.octave = true;
});

describe("users.rights et « Accès à Octave »", () => {
  it("permis : l'extension de musique sert le compte", async () => {
    expect(await userRights("musique", USER)).toEqual({ exists: true, isAdmin: false, canUse: true, canRequest: true, familyGuest: false });
  });

  it("coupé : ni usage ni demande", async () => {
    state.octave = false;
    expect(await userRights("musique", USER)).toEqual({ exists: true, isAdmin: false, canUse: false, canRequest: false, familyGuest: false });
  });
});
