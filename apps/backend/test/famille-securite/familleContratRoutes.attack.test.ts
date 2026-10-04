/**
 * Tests d'attaque — les invariants de SÉCURITÉ portés par le CONTRAT de routes
 * (`src/family/familyRoutes.ts` + `familyProtocol.ts`, déjà fusionnés). Ici on
 * n'exécute pas le serveur : on vérifie que la TABLE des routes dit bien ce que
 * la sécurité exige (appelants autorisés, identifiants hors des URL, codes de
 * refus présents). Ces invariants sont la première ligne — si quelqu'un élargit
 * un jour les appelants d'« accepter » à une TV, ou glisse un identifiant dans
 * une URL journalisée, un de ces tests devient rouge.
 *
 * Ce qui exige le serveur en marche (IDOR réel, révocation, PIN haché, Quick
 * Connect, listes, démo, parité HTTP) vit dans `familleServeur.attente.test.ts`,
 * en `it.todo` tant que le socle d'auth de T2 n'est pas fusionné.
 */

import { describe, expect, it } from "vitest";
import {
  FAMILY_ROUTES,
  type FamilyCaller,
  type FamilyRouteName,
} from "../../src/family/familyRoutes";
import { FAMILY_ERROR_STATUS } from "../../src/family/familyProtocol";

type Spec = (typeof FAMILY_ROUTES)[FamilyRouteName];
const entries = Object.entries(FAMILY_ROUTES) as Array<[FamilyRouteName, Spec]>;

function callersOf(name: FamilyRouteName): readonly FamilyCaller[] {
  return FAMILY_ROUTES[name].callers;
}

// ── SEC-F-04 : accepter / refuser / « plus tard » — session PERSONNELLE seule ─

describe("SEC-F-04 : un geste personnel sur une invitation ne vient jamais d'une TV", () => {
  it.each(["acceptInvite", "declineInvite", "snoozeInvite"] as const)(
    "%s n'autorise QUE la session personnelle (ni TV, ni profil de TV, ni admin)",
    (name) => {
      expect(callersOf(name)).toEqual(["personal"]);
    },
  );
});

// ── SEC-F-02 / SEC-F-27 : l'identifiant d'invitation voyage dans le CORPS ─────

describe("SEC-F-27 : aucun identifiant d'invitation dans une URL (journalisée)", () => {
  it.each(["acceptInvite", "declineInvite", "snoozeInvite", "cancelInvite"] as const)(
    "%s ne porte aucun paramètre de chemin",
    (name) => {
      expect(FAMILY_ROUTES[name].path).not.toContain(":");
    },
  );

  it("ces gestes sont des POST (un corps, pas une query)", () => {
    for (const name of ["acceptInvite", "declineInvite", "snoozeInvite", "cancelInvite"] as const) {
      expect(FAMILY_ROUTES[name].method).toBe("POST");
    }
  });
});

// ── SEC-F-07 : les routes du propriétaire ne nomment aucune FAMILLE ───────────

describe("SEC-F-07 : le propriétaire agit sur SA famille, déduite du jeton", () => {
  const ownerRoutes: FamilyRouteName[] = [
    "dissolve",
    "createGuest",
    "deleteGuest",
    "setGuestPin",
    "removeMember",
    "invite",
    "cancelInvite",
  ];

  it.each(ownerRoutes)("%s ne prend aucun identifiant de famille dans son URL", (name) => {
    expect(FAMILY_ROUTES[name].path).not.toContain(":familyId");
  });

  it("seule la sortie d'un membre nomme la famille (:familyId) — c'est une route de MEMBRE, pas de propriétaire", () => {
    expect(FAMILY_ROUTES.leave.path).toContain(":familyId");
    expect(callersOf("leave")).toEqual(["personal"]);
  });
});

// ── SEC-F-19 : le jeton de JUMELAGE d'une TV ne sert qu'à lister/ouvrir/s'enrôler

describe("SEC-F-19 : le jeton de jumelage « profils seuls » a un périmètre minimal", () => {
  const allowedForPairing: FamilyRouteName[] = ["tvEnroll", "tvProfiles", "tvOpenSession"];

  it("n'est l'appelant d'AUCUNE route hors enroll / profiles / sessions", () => {
    for (const [name, spec] of entries) {
      if (allowedForPairing.includes(name)) continue;
      expect(spec.callers).not.toContain("tvPairing");
    }
  });

  it("l'overview est PARTAGÉ (membre compris, v2) mais jamais ouvert au jeton de jumelage", () => {
    // v2 : la TV d'un membre montre toute la famille → memberTv est admis.
    // Le jeton de jumelage « profils seuls » (tvPairing), lui, ne voit JAMAIS l'overview.
    expect(callersOf("overview")).toEqual(["personal", "ownerTv", "memberTv"]);
    expect(callersOf("overview")).not.toContain("tvPairing");
  });

  it("lister les profils et en ouvrir un : le jeton de jumelage, et lui seul", () => {
    expect(callersOf("tvProfiles")).toEqual(["tvPairing"]);
    expect(callersOf("tvOpenSession")).toEqual(["tvPairing"]);
  });
});

// ── SEC-F-18 : « Gérer les profils » n'est ouvert qu'à une session de profil ──

describe("SEC-F-18 : le déverrouillage de gestion passe par une session de profil (PIN du propriétaire)", () => {
  it("tvManageUnlock n'est appelable que par une session de profil (jamais le seul jeton de jumelage)", () => {
    expect(callersOf("tvManageUnlock")).toEqual(["tvProfile"]);
  });
});

// ── SEC-F-10/11 + SEC-F-12 : retrait et suppression gardés par le propriétaire ─

describe("rôles v2 : retirer un membre reste au propriétaire, supprimer un invité s'ouvre au membre", () => {
  it("removeMember : le propriétaire SEUL (personnel ou sa TV) — jamais un membre, un profil quelconque ou le jumelage", () => {
    expect(callersOf("removeMember")).toEqual(["personal", "ownerTv"]);
    expect(callersOf("removeMember")).not.toContain("memberTv"); // un membre ne retire personne
    expect(callersOf("removeMember")).not.toContain("tvProfile");
    expect(callersOf("removeMember")).not.toContain("tvPairing");
  });

  it("deleteGuest : propriétaire OU membre depuis sa TV (memberTv) — la garde « ses seuls invités » est au runtime (SEC-F-39) ; jamais le jumelage", () => {
    expect(callersOf("deleteGuest")).toEqual(["personal", "ownerTv", "memberTv"]);
    expect(callersOf("deleteGuest")).not.toContain("tvProfile"); // pas un profil d'invité
    expect(callersOf("deleteGuest")).not.toContain("tvPairing");
  });
});

// ── Les codes de refus existent, avec le bon statut HTTP ──────────────────────

// ── SEC-F-38 (v2) : régler les droits d'un membre est un geste de gestion ─────

describe("SEC-F-38 : seul le propriétaire (sa session, ou sa TV) règle les droits d'un membre", () => {
  it("setMemberRights existe, PUT, et n'est appelable ni par un jeton de jumelage ni par une session de profil quelconque", () => {
    expect(FAMILY_ROUTES.setMemberRights.method).toBe("PUT");
    expect(callersOf("setMemberRights")).toEqual(["personal", "ownerTv"]);
    expect(callersOf("setMemberRights")).not.toContain("tvPairing");
    expect(callersOf("setMemberRights")).not.toContain("tvProfile");
    expect(callersOf("setMemberRights")).not.toContain("memberTv");
  });

  it("la cible du réglage est dans l'URL (un membre précis), le droit dans le corps", () => {
    expect(FAMILY_ROUTES.setMemberRights.path).toContain(":userId");
  });
});

describe("protocole : chaque refus du modèle de menace a son code et son statut", () => {
  it.each([
    ["family.not_found", 404], // SEC-F-03 IDOR : « inexistant » == « pas à toi »
    ["family.not_owner", 403], // SEC-F-07 un membre n'est pas propriétaire
    ["family.personal_session_required", 403], // SEC-F-04 geste personnel hors TV
    ["family.pairing_required", 401], // SEC-F-15 jumelage disparu
    ["family.profile_unavailable", 403], // SEC-F-08 profil hors de la famille de la TV
    ["family.invite_expired", 410], // SEC-F-05 invitation expirée
    ["family.pin_invalid", 403], // SEC-F-17 mauvais PIN
    ["family.pin_locked", 423], // SEC-F-17 verrou
    ["family.pin_format", 400], // SEC-F-16 format
    ["family.invite_quota", 429], // SEC-F-23
    ["family.invite_cooldown", 429], // SEC-F-23 délai après refus
    ["family.guest_quota", 429], // SEC-F-23 six invités / 24 h
    ["family.review_account", 403], // SEC-F-28 compte de démonstration
    ["family.guest_account", 403], // un invité ne gère rien
    ["family.full", 409], // SEC-F-33
    ["family.guests_full", 409], // SEC-F-33
    ["family.guest_right_required", 403], // SEC-F-38 v2 : un membre sans le droit de créer
    ["family.already_in_family", 409], // SEC-F-36 v2 : une seule famille par personne
    ["family.owner_must_dissolve", 403], // SEC-F-37 v2 : le propriétaire ne quitte pas, il dissout
  ] as const)("%s → %i", (code, status) => {
    expect(FAMILY_ERROR_STATUS[code as keyof typeof FAMILY_ERROR_STATUS]).toBe(status);
  });

  it("family.not_found répond pareil à « n'existe pas » et « pas à vous » (anti-énumération, SEC-F-03/06)", () => {
    // Le contrat l'impose par un code UNIQUE 404 : il n'existe pas de code
    // distinct « existe mais pas à toi » qui confirmerait l'existence.
    const codes = Object.keys(FAMILY_ERROR_STATUS);
    expect(codes).toContain("family.not_found");
    expect(codes).not.toContain("family.forbidden_other"); // garde-fou : pas de code révélateur
  });
});
