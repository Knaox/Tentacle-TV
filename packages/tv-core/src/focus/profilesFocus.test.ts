import { describe, expect, it } from "vitest";

import {
  GUEST_CREATE_KEY,
  GUEST_NAME_KEY,
  INVITE_SEARCH_KEY,
  MANAGE_BACK_KEY,
  MANAGE_CREATE_KEY,
  MANAGE_INVITE_KEY,
  PROFILES_BACK_KEY,
  inviteCandidateFocusable,
  inviteCandidateKey,
  inviteCandidateOrder,
  manageEntryKey,
  manageFocusAfterRemoval,
  manageGuardedKeys,
  manageRowKey,
  pinDigitKey,
  profilesGuardedKeys,
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

describe("le clic fantôme", () => {
  it("garde chaque profil, chaque touche du pavé et les actions — jamais la croix", () => {
    const keys = profilesGuardedKeys();
    expect(keys).toContain(profileTileKey(5));
    expect(keys).toContain(pinDigitKey("0"));
    expect(keys).toContain("pin:erase");
    expect(keys).not.toContain(PROFILES_BACK_KEY);
    expect(manageGuardedKeys()).toContain("guest:create");
    expect(manageGuardedKeys()).toContain("invite:candidate:4");
    expect(manageGuardedKeys()).not.toContain(MANAGE_BACK_KEY);
  });
});

describe("la recherche d'invitation (retours d'essai)", () => {
  const found = [
    { id: "a", status: "in_family" as const },
    { id: "b", status: "available" as const },
    { id: "c", status: "invited" as const },
    { id: "d", status: "available" as const },
    { id: "e" },
  ];

  it("range les invitables d'abord, l'ordre du serveur dans chaque groupe", () => {
    expect(inviteCandidateOrder(found).map((candidate) => candidate.id)).toEqual(["b", "d", "e", "c", "a"]);
  });

  it("ne donne le focus qu'aux invitables, et à l'invitation qu'on vient d'envoyer", () => {
    expect(inviteCandidateFocusable({ status: "available", sent: false })).toBe(true);
    expect(inviteCandidateFocusable({ sent: false })).toBe(true);
    expect(inviteCandidateFocusable({ status: "in_family", sent: false })).toBe(false);
    expect(inviteCandidateFocusable({ status: "invited", sent: false })).toBe(false);
    expect(inviteCandidateFocusable({ status: "available", sent: true })).toBe(true);
  });

  it("Retour depuis un résultat remonte à la recherche, depuis la recherche à la liste", () => {
    expect(manageBackAction("invite", "settings", inviteCandidateKey(2))).toBe("toSearch");
    expect(manageBackAction("invite", "settings", INVITE_SEARCH_KEY)).toBe("toList");
    expect(manageBackAction("invite", "profiles", null)).toBe("toList");
    expect(manageBackAction("list", "profiles", inviteCandidateKey(0))).toBe("toProfiles");
  });
});
