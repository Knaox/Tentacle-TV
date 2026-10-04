import { describe, expect, it } from "vitest";

import {
  GUEST_CREATE_KEY,
  GUEST_NAME_KEY,
  INVITE_SEARCH_KEY,
  MANAGE_BACK_KEY,
  MANAGE_CREATE_KEY,
  MANAGE_INVITE_KEY,
  PROFILES_BACK_KEY,
  manageEntryKey,
  manageFocusAfterRemoval,
  manageRowKey,
  pinDigitKey,
  profileTileKey,
  profilesEntryKey,
} from "./profilesFocus";
import { manageBackAction, profilesBackAction } from "../nav/profilesBack";

describe("le focus de « Qui regarde ? »", () => {
  it("entre sur le profil qu'on vient de quitter, sinon le premier", () => {
    expect(profilesEntryKey({ phase: "picker", tileIndex: 2 })).toBe(profileTileKey(2));
    expect(profilesEntryKey({ phase: "picker" })).toBe("profiles:tile:0");
  });

  it("entre sur le premier chiffre du pavé, ou sur la croix quand il est bloqué", () => {
    expect(profilesEntryKey({ phase: "pin" })).toBe(pinDigitKey("1"));
    expect(profilesEntryKey({ phase: "pin", pinLocked: true })).toBe(PROFILES_BACK_KEY);
  });

  it("une erreur entre par « Réessayer », un chargement par rien", () => {
    expect(profilesEntryKey({ phase: "error" })).toBe("status:primary");
    expect(profilesEntryKey({ phase: "loading" })).toBeNull();
  });
});

describe("le focus de « Gérer les profils »", () => {
  const list = { view: "list" as const, canCreateGuest: true, canInvite: true, actionRows: [1, 2, 3] };

  it("entre par la première action possible", () => {
    expect(manageEntryKey(list)).toBe(MANAGE_CREATE_KEY);
    expect(manageEntryKey({ ...list, canCreateGuest: false })).toBe(MANAGE_INVITE_KEY);
    expect(manageEntryKey({ ...list, canCreateGuest: false, canInvite: false })).toBe(manageRowKey(1));
    expect(manageEntryKey({ ...list, canCreateGuest: false, canInvite: false, actionRows: [] })).toBe(MANAGE_BACK_KEY);
  });

  it("entre dans un invité par son nom, puis par « Créer » ; dans une invitation par la recherche", () => {
    expect(manageEntryKey({ ...list, view: "guest" })).toBe(GUEST_NAME_KEY);
    expect(manageEntryKey({ ...list, view: "guest", guestNamed: true })).toBe(GUEST_CREATE_KEY);
    expect(manageEntryKey({ ...list, view: "invite" })).toBe(INVITE_SEARCH_KEY);
  });

  it("après un retrait, la ligne qui prend la place, sinon la précédente, sinon l'entrée", () => {
    expect(manageFocusAfterRemoval(list, 2)).toBe(manageRowKey(2));
    expect(manageFocusAfterRemoval(list, 3)).toBe(manageRowKey(2));
    expect(manageFocusAfterRemoval({ ...list, actionRows: [1] }, 1)).toBe(MANAGE_CREATE_KEY);
  });
});

describe("le Retour des profils", () => {
  it("« Qui regarde ? » laisse Menu quitter l'app ; le pavé recule vers les profils", () => {
    expect(profilesBackAction("picker")).toBeNull();
    expect(profilesBackAction("error")).toBeNull();
    expect(profilesBackAction("pin")).toBe("closePin");
  });

  it("une page de la gestion recule vers la liste, la liste vers son origine", () => {
    expect(manageBackAction("guest", "settings")).toBe("toList");
    expect(manageBackAction("invite", "profiles")).toBe("toList");
    expect(manageBackAction("list", "settings")).toBe("toSettings");
    expect(manageBackAction("list", "profiles")).toBe("toProfiles");
  });
});
