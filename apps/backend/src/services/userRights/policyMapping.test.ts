import { describe, expect, it } from "vitest";
import { USER_RIGHTS_KEYS } from "../../userRights/userRightsContract";
import { applyRightsPatch, rightsFromPolicy, unappliedKeys } from "./policyMapping";

const USER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("UserPolicy ↔ droits", () => {
  it("une politique vide se lit au plus fermé : désactivé, rien de permis", () => {
    const rights = rightsFromPolicy({});
    expect(Object.keys(rights).sort()).toEqual([...USER_RIGHTS_KEYS].sort());
    expect(rights.isDisabled).toBe(true);
    expect(rights.enableMediaPlayback).toBe(false);
    expect(rights.syncPlayAccess).toBe("None");
    expect(rights.maxParentalRating).toBeNull();
  });

  it("lit les identifiants sans tirets, les plages en camelCase, ignore l'inconnu", () => {
    const rights = rightsFromPolicy({
      EnabledFolders: ["F137A2DD-21BB-C1B9-9AA5-C0F6BF02A805"],
      BlockUnratedItems: ["Movie", "Hologram"],
      AccessSchedules: [{ Id: 4, UserId: USER, DayOfWeek: "Weekday", StartHour: 7.5, EndHour: 21 }],
      SyncPlayAccess: "JoinGroups",
    });
    expect(rights.enabledFolders).toEqual(["f137a2dd21bbc1b99aa5c0f6bf02a805"]);
    expect(rights.blockUnratedItems).toEqual(["Movie"]);
    expect(rights.accessSchedules).toEqual([{ dayOfWeek: "Weekday", startHour: 7.5, endHour: 21 }]);
    expect(rights.syncPlayAccess).toBe("JoinGroups");
  });

  it("n'écrit que les champs du correctif ; les plages repartent dans la forme de Jellyfin, sans Id", () => {
    const policy = { AuthenticationProviderId: "a", IsHidden: false, AccessSchedules: [{ Id: 4, DayOfWeek: "Monday", StartHour: 1, EndHour: 2 }] };
    const next = applyRightsPatch(USER, policy, { isHidden: true, accessSchedules: [{ dayOfWeek: "Sunday", startHour: 8, endHour: 12 }] });
    expect(next).toEqual({
      AuthenticationProviderId: "a",
      IsHidden: true,
      AccessSchedules: [{ DayOfWeek: "Sunday", StartHour: 8, EndHour: 12, UserId: USER }],
    });
    expect(policy.IsHidden).toBe(false);
  });

  it("repère ce que Jellyfin n'a pas retenu, sans tenir compte de l'ordre des listes", () => {
    const reread = rightsFromPolicy({ BlockedTags: ["b", "a"], IsHidden: false });
    expect(unappliedKeys({ blockedTags: ["a", "b"], isHidden: true }, reread)).toEqual(["isHidden"]);
  });
});
