/**
 * Tests d'attaque T8 — Famille v2, les RÈGLES PURES (déjà fusionnées :
 * `familyRights.ts`). On attaque directement la logique des droits et des
 * candidats que le serveur applique. Le BRANCHEMENT de ces règles aux routes
 * (candidats v2 servis, droits délégués effectifs, unicité) suit chez T2 :
 * ses tests runtime attendent dans `familleV2.attente.test.ts`.
 *
 * SEC-F-37 (qui gère quoi), SEC-F-38 (droit de créer des invités), SEC-F-39
 * (un membre ne gère que SES invités), SEC-F-42 (candidats v2 bornés).
 */

import { describe, expect, it } from "vitest";
import { FAMILY_DEFAULT_MEMBER_RIGHTS } from "../../src/family/familyContract";
import {
  canManageGuest,
  familyCandidates,
  familyRightsOf,
  type FamilyCandidateSource,
} from "../../src/family/familyRights";

const ON = { families: true, guests: true };

// ── SEC-F-37/38 : ce que chaque rôle peut ────────────────────────────────────
describe("SEC-F-37/38 : les droits se déduisent du rôle, jamais d'un client", () => {
  it("le propriétaire gère les membres et TOUS les invités ; il crée si la Famille et les invités sont allumés", () => {
    expect(familyRightsOf("owner", null, ON)).toEqual({ manageMembers: true, createGuests: true, manageGuests: "all" });
    expect(familyRightsOf("owner", null, { families: true, guests: false }).createGuests).toBe(false);
  });

  it("un membre ne gère jamais les membres, ne gère QUE ses invités, et ne crée QUE si le propriétaire lui en a donné le droit", () => {
    const withRight = familyRightsOf("member", { createGuests: true }, ON);
    expect(withRight).toEqual({ manageMembers: false, createGuests: true, manageGuests: "own" });
    // Droit par défaut = coupé.
    expect(familyRightsOf("member", FAMILY_DEFAULT_MEMBER_RIGHTS, ON).createGuests).toBe(false);
    expect(familyRightsOf("member", null, ON).createGuests).toBe(false);
    // Même avec le droit, les invités coupés par l'admin referment la création.
    expect(familyRightsOf("member", { createGuests: true }, { families: true, guests: false }).createGuests).toBe(false);
  });

  it("sans rôle (hors de la famille) : aucun droit", () => {
    expect(familyRightsOf(null, null, ON)).toEqual({ manageMembers: false, createGuests: false, manageGuests: "none" });
    expect(familyRightsOf(null, { createGuests: true }, ON).createGuests).toBe(false);
  });
});

// ── SEC-F-39 : un membre ne supprime/épingle que SES invités ──────────────────
describe("SEC-F-39 : la gestion d'un invité tient à qui l'a créé", () => {
  const owner = familyRightsOf("owner", null, ON);
  const member = familyRightsOf("member", { createGuests: true }, ON);

  it("le propriétaire gère n'importe quel invité (manageGuests « all »)", () => {
    expect(canManageGuest(owner, "autre-membre", "le-proprio")).toBe(true);
    expect(canManageGuest(owner, null, "le-proprio")).toBe(true);
  });

  it("un membre ne gère QUE les invités qu'il a créés (createdBy)", () => {
    expect(canManageGuest(member, "le-membre", "le-membre")).toBe(true);
    expect(canManageGuest(member, "un-autre", "le-membre")).toBe(false);
    expect(canManageGuest(member, null, "le-membre")).toBe(false);
    // Insensible aux tirets/casse des identifiants Jellyfin.
    expect(canManageGuest(member, "AB-CD", "abcd")).toBe(true);
  });

  it("sans droit de gestion (« none »), rien", () => {
    const none = familyRightsOf(null, null, ON);
    expect(canManageGuest(none, "soi", "soi")).toBe(false);
  });
});

// ── SEC-F-42 : candidats v2 — énumération VOULUE mais BORNÉE ───────────────────
describe("SEC-F-42 : les candidats listent tous les comptes, sans fuite", () => {
  const users: FamilyCandidateSource[] = [
    { id: "u-alice", name: "Alice", isDisabled: false, imageTag: "t1" },
    { id: "u-cache", name: "ComptePrivé", isDisabled: false, imageTag: null }, // un « caché » de l'écran de connexion
    { id: "u-ban", name: "Banni", isDisabled: true, imageTag: null },
    { id: "u-membre", name: "DéjàMembre", isDisabled: false, imageTag: null },
    { id: "u-invite-pend", name: "Invité·e", isDisabled: false, imageTag: null },
  ];
  const opts = { exclude: ["u-moi"], inFamily: ["u-membre"], invited: ["u-invite-pend"], limit: 50 };

  it("un compte « caché » EST proposé (v2), même en recherche partielle", () => {
    const out = familyCandidates(users, { query: "compte", ...opts });
    expect(out.map((c) => c.userId)).toContain("u-cache");
  });

  it("jamais un compte désactivé, ni un exclu (soi, invités, démo)", () => {
    const out = familyCandidates(users, { query: "", ...opts });
    const ids = out.map((c) => c.userId);
    expect(ids).not.toContain("u-ban"); // désactivé
    expect(ids).not.toContain("u-moi"); // exclu
  });

  it("un compte déjà en famille ou invité est rendu MARQUÉ (non invitable), jamais caché", () => {
    const out = familyCandidates(users, { query: "", ...opts });
    const byId = new Map(out.map((c) => [c.userId, c.status]));
    expect(byId.get("u-membre")).toBe("in_family");
    expect(byId.get("u-invite-pend")).toBe("invited");
    expect(byId.get("u-alice")).toBe("available");
    // Les invitables d'abord.
    expect(out[0].status).toBe("available");
  });

  it("ne révèle QUE userId, nom, avatar et statut — jamais une politique, un e-mail, ou la famille d'autrui", () => {
    const [c] = familyCandidates(users, { query: "Alice", ...opts });
    expect(Object.keys(c).sort()).toEqual(["imageTag", "name", "status", "userId"]);
    // Le « in_family » ne dit PAS DANS QUELLE famille (pas de familyId exposé).
    const marked = familyCandidates(users, { query: "DéjàMembre", ...opts })[0];
    expect(Object.keys(marked)).not.toContain("familyId");
  });
});
