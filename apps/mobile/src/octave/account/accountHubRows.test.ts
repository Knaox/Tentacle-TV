import { describe, expect, it } from "vitest";
import type { SettingsCatalogContext } from "@tentacle-tv/shared";
import { accountCatalogIds, accountProfileRows } from "./accountHubRows";

const base: SettingsCatalogContext = {
  platform: "mobile",
  capabilities: new Set(),
  offline: false,
  isAdmin: false,
  offlineVisible: true,
  canGoOffline: true,
  family: true,
  familyEntry: true,
  canSwitchProfile: true,
  launchAsked: true,
  liquidGlass: false,
  advancedEngine: false,
  engineOptions: false,
  abilities: new Set(),
  bootIntro: false,
  liveTransfers: false,
  profileSession: false,
};

const rows = (ctx: Partial<SettingsCatalogContext>, pin: { shown: boolean } | null = { shown: true }) =>
  accountProfileRows({ catalogIds: accountCatalogIds({ ...base, ...ctx }), pin, online: !(ctx.offline ?? false) });

describe("hub Compte d'Octave — le groupe « Profil »", () => {
  it("session personnelle dans une famille : changer, son code, gérer", () => {
    expect(rows({})).toEqual(["switchProfile", "pin", "manageProfiles"]);
  });

  it("session de PROFIL : changer seulement — ni « Gérer les profils » (geste personnel), ni PIN si la Famille ne le propose pas", () => {
    expect(rows({ profileSession: true }, { shown: false })).toEqual(["switchProfile"]);
  });

  it("un seul profil : pas de « Changer de profil »", () => {
    expect(rows({ canSwitchProfile: false })).toEqual(["pin", "manageProfiles"]);
  });

  it("serveur sans Famille : rien du catalogue, le PIN absent tant que la Famille n'a pas répondu", () => {
    expect(rows({ family: false, canSwitchProfile: false }, null)).toEqual([]);
  });

  it("la Famille n'a rien à montrer à ce compte : pas de « Gérer les profils »", () => {
    expect(rows({ familyEntry: false })).toEqual(["switchProfile", "pin"]);
  });

  it("hors ligne : ni « Code PIN » (il ne s'enregistrerait pas) ni rien de la Famille, même avec une vue d'ensemble en cache", () => {
    expect(rows({ offline: true, canSwitchProfile: false, family: false })).toEqual([]);
    expect(accountProfileRows({ catalogIds: new Set(), pin: { shown: true }, online: false })).toEqual([]);
  });

  it("hors ligne : la photo et le nom quittent le catalogue, le changement de profil suit sa règle", () => {
    const ids = accountCatalogIds({ ...base, offline: true });
    expect(ids.has("photo")).toBe(false);
    expect(ids.has("userName")).toBe(false);
  });
});
