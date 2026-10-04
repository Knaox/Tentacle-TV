/**
 * Tests d'attaque — les RÈGLES PURES de la Famille (`src/family/familyRules.ts`,
 * déjà fusionnées : contrat de T2, commit 29edda6cc). Ici, pas de serveur :
 * on attaque directement la logique que le serveur applique et que les clients
 * lisent. Ces tests sont ACTIFS (la règle existe), ils gardent la garde verte.
 *
 * Ce qui attend le socle d'auth de T2 (routes, PIN haché serveur, révocation,
 * Quick Connect, proxy) vit dans les fichiers voisins, marqué en attente.
 *
 * Chaque bloc porte l'identifiant `SEC-F-xx` du modèle de menace
 * (`test/famille-securite/MODELE-MENACE.md`).
 */

import { describe, expect, it } from "vitest";
import {
  FAMILY_GUESTS_PER_DAY,
  FAMILY_GUEST_NAME_MAX,
  FAMILY_INVITES_PER_DAY,
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PENDING_PER_INVITEE,
  FAMILY_MAX_PROFILES,
  FAMILY_PIN_MAX_FAILURES,
  FAMILY_PIN_LOCK_STEPS_MS,
} from "../../src/family/familyContract";
import {
  afterPinFailure,
  canAcceptInvitation,
  capacityError,
  effectiveInvitationStatus,
  guestAccountName,
  guestQuotaBlock,
  inviteBlock,
  isProfileKindAllowed,
  isValidPin,
  normalizeGuestName,
  pinGate,
  pinLockDuration,
  selectCandidates,
  type CandidateSource,
  type InviteHistory,
  type PinAttemptState,
} from "../../src/family/familyRules";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ── SEC-F-33 : limites 6 profils / 3 invités, sûres sous concurrence ──────────

describe("SEC-F-33 : capacité imposée par le serveur", () => {
  it("refuse le 7e profil (le propriétaire compte pour un)", () => {
    // 1 (propriétaire) + 4 membres + 1 invité = 6 profils pris, pendingInvitations 0.
    const full = { members: 4, guests: 1, pendingInvitations: 0 };
    expect(1 + full.members + full.guests).toBe(FAMILY_MAX_PROFILES);
    expect(capacityError("member", full)).toBe("family.full");
    expect(capacityError("guest", full)).toBe("family.full");
  });

  it("une invitation en attente RÉSERVE sa place (pas de dépassement par la porte des invitations)", () => {
    // 1 + 3 membres + 0 invité + 2 invitations en attente = 6 : plus de place.
    const counts = { members: 3, guests: 0, pendingInvitations: 2 };
    expect(capacityError("member", counts)).toBe("family.full");
  });

  it("refuse le 4e invité même quand il reste de la place en profils", () => {
    // 1 + 0 membre + 3 invités = 4 profils : il reste 2 places, mais 3 invités = plafond.
    const counts = { members: 0, guests: FAMILY_MAX_GUESTS, pendingInvitations: 0 };
    expect(capacityError("guest", counts)).toBe("family.guests_full");
    // Un membre, lui, peut encore entrer.
    expect(capacityError("member", counts)).toBeNull();
  });

  it("une acceptation ne dépasse jamais le plafond, même en course (deux acceptations à égalité)", () => {
    // 5 profils présents (1 + 4) : une seule acceptation tient.
    expect(canAcceptInvitation({ members: 4, guests: 0 })).toBe(true);
    // 6 profils présents : plus aucune acceptation, quoi qu'ait réservé l'invitation.
    expect(canAcceptInvitation({ members: 5, guests: 0 })).toBe(false);
    expect(canAcceptInvitation({ members: 4, guests: 1 })).toBe(false);
  });
});

// ── SEC-F-23 : quotas anti-spam d'invitations et d'invités ────────────────────

describe("SEC-F-23 : quotas d'invitation", () => {
  const base: InviteHistory = {
    pendingForInvitee: false,
    lastDeclinedAt: null,
    sentInLastDay: [],
    inviteePendingTotal: 0,
  };

  it("refuse une seconde invitation en attente pour le même compte", () => {
    expect(inviteBlock({ ...base, pendingForInvitee: true }, 0)).toEqual({ code: "family.invite_pending" });
  });

  it("impose un délai de 7 jours après un refus, avec retryAt", () => {
    const now = 10 * DAY;
    const lastDeclinedAt = now - 3 * DAY; // refusé il y a 3 j < 7 j
    const block = inviteBlock({ ...base, lastDeclinedAt }, now);
    expect(block?.code).toBe("family.invite_cooldown");
    expect(block?.retryAt).toBe(lastDeclinedAt + 7 * DAY);
    // Au-delà de 7 jours, on peut réinviter.
    expect(inviteBlock({ ...base, lastDeclinedAt: now - 8 * DAY }, now)).toBeNull();
  });

  it("plafonne les invitations à 10 par 24 h glissantes", () => {
    const now = 100 * DAY;
    const sentInLastDay = Array.from({ length: FAMILY_INVITES_PER_DAY }, (_, i) => now - i * HOUR);
    const block = inviteBlock({ ...base, sentInLastDay }, now);
    expect(block?.code).toBe("family.invite_quota");
    // Une invitation vieille de plus de 24 h ne compte plus.
    const old = Array.from({ length: FAMILY_INVITES_PER_DAY }, () => now - 25 * HOUR);
    expect(inviteBlock({ ...base, sentInLastDay: old }, now)).toBeNull();
  });

  it("plafonne les invitations EN ATTENTE reçues par un même compte (anti-harcèlement multi-familles)", () => {
    expect(inviteBlock({ ...base, inviteePendingTotal: FAMILY_MAX_PENDING_PER_INVITEE }, 0)?.code).toBe(
      "family.invite_quota",
    );
  });
});

describe("SEC-F-23 : quota de création d'invités (chacun est un compte Jellyfin)", () => {
  it("refuse au-delà de 6 invités créés par 24 h, avec retryAt", () => {
    const now = 100 * DAY;
    const created = Array.from({ length: FAMILY_GUESTS_PER_DAY }, (_, i) => now - i * HOUR);
    const block = guestQuotaBlock(created, now);
    expect(block?.code).toBe("family.guest_quota");
    expect(block?.retryAt).toBe(created[created.length - 1] + DAY);
  });

  it("ne compte pas les créations de plus de 24 h", () => {
    const now = 100 * DAY;
    const old = Array.from({ length: FAMILY_GUESTS_PER_DAY }, () => now - 25 * HOUR);
    expect(guestQuotaBlock(old, now)).toBeNull();
  });
});

// ── SEC-F-17 : le PIN se bloque après 5 essais, blocages croissants ───────────

describe("SEC-F-17 : verrou du PIN", () => {
  it("accorde 5 essais puis bloque", () => {
    let state: PinAttemptState | null = null;
    const now = 0;
    for (let i = 1; i < FAMILY_PIN_MAX_FAILURES; i++) {
      const step = afterPinFailure(state, now);
      expect(step.lockedUntil).toBeNull();
      expect(step.attemptsLeft).toBe(FAMILY_PIN_MAX_FAILURES - i);
      state = step.state;
    }
    // 5e échec : blocage.
    const last = afterPinFailure(state, now);
    expect(last.attemptsLeft).toBe(0);
    expect(last.lockedUntil).toBe(now + FAMILY_PIN_LOCK_STEPS_MS[0]);
    // La porte est fermée tant que le blocage court — même avec le bon PIN (le
    // serveur consulte pinGate AVANT de comparer).
    const gate = pinGate(last.state, now + 1);
    expect(gate).toEqual({ locked: true, until: last.lockedUntil });
  });

  it("alloue des blocages de plus en plus longs (le dernier palier se répète)", () => {
    expect(pinLockDuration(0)).toBe(FAMILY_PIN_LOCK_STEPS_MS[0]);
    expect(pinLockDuration(1)).toBeGreaterThan(pinLockDuration(0));
    const lastStep = FAMILY_PIN_LOCK_STEPS_MS[FAMILY_PIN_LOCK_STEPS_MS.length - 1];
    expect(pinLockDuration(99)).toBe(lastStep);
  });

  it("après un blocage échu, repart de zéro essai mais garde son rang (le prochain dure plus)", () => {
    // Un profil déjà bloqué une fois, blocage terminé.
    const expired: PinAttemptState = { failures: 0, lockCount: 1, lockedUntil: 100 };
    const now = 200; // > lockedUntil
    const step = afterPinFailure(expired, now);
    // Ce n'est que le 1er échec post-blocage : pas de re-blocage immédiat.
    expect(step.lockedUntil).toBeNull();
    expect(step.attemptsLeft).toBe(FAMILY_PIN_MAX_FAILURES - 1);
    expect(step.state.lockCount).toBe(1);
  });

  it("n'accepte que quatre chiffres (format strict, pas de contournement par type)", () => {
    expect(isValidPin("1234")).toBe(true);
    for (const bad of ["123", "12345", "12a4", " 123", "", "0x12", 1234 as unknown, null]) {
      expect(isValidPin(bad)).toBe(false);
    }
  });
});

// ── SEC-F-22 : candidats — comptes cachés non énumérables ─────────────────────

describe("SEC-F-22 : sélection des candidats à l'invitation", () => {
  const users: CandidateSource[] = [
    { id: "visible1", name: "Alice", isHidden: false, isDisabled: false, imageTag: "t" },
    { id: "visible2", name: "Alain", isHidden: false, isDisabled: false, imageTag: null },
    { id: "hidden", name: "SecretAdmin", isHidden: true, isDisabled: false, imageTag: null },
    { id: "disabled", name: "Banni", isHidden: false, isDisabled: true, imageTag: null },
  ];

  it("ne révèle jamais un compte caché par une recherche partielle (anti-énumération)", () => {
    for (const q of ["", "Secret", "secretadm", "S", "Admin"]) {
      const out = selectCandidates(users, { query: q, exclude: [], limit: 50 });
      expect(out.find((c) => c.userId === "hidden")).toBeUndefined();
    }
  });

  it("ne rend un compte caché QUE sur son nom exact (casse indifférente)", () => {
    const out = selectCandidates(users, { query: "secretadmin", exclude: [], limit: 50 });
    expect(out.map((c) => c.userId)).toContain("hidden");
  });

  it("un nom caché inconnu et un nom inexistant rendent le MÊME résultat (vide) : rien ne confirme l'existence", () => {
    const inconnu = selectCandidates(users, { query: "NExistePas", exclude: [], limit: 50 });
    const cacheNonDeviné = selectCandidates(users, { query: "SecretAdmi", exclude: [], limit: 50 });
    expect(inconnu).toEqual([]);
    expect(cacheNonDeviné).toEqual([]);
  });

  it("n'offre jamais un compte désactivé, ni soi-même, ni un membre/invité/invitation déjà là (exclude)", () => {
    const out = selectCandidates(users, { query: "", exclude: ["visible2"], limit: 50 });
    const ids = out.map((c) => c.userId);
    expect(ids).not.toContain("disabled"); // désactivé
    expect(ids).not.toContain("visible2"); // exclu (soi/membre/invité)
    expect(ids).toContain("visible1");
    // exclude insensible à la casse et aux tirets (identifiants Jellyfin).
    const folded = selectCandidates(users, { query: "", exclude: ["VISI-BLE1"], limit: 50 });
    expect(folded.map((c) => c.userId)).not.toContain("visible1");
  });
});

// ── SEC-F-24 : noms d'invité — injection et longueur ──────────────────────────

describe("SEC-F-24 : nettoyage des noms d'invité", () => {
  it("retire les caractères invisibles et de direction (anti-usurpation visuelle/RTL)", () => {
    // Zero-width space, RTL override, BOM, retour chariot : TOUS écartés (les
    // contrôles comme les marques invisibles), rien ne subsiste entre B et D.
    const piégé = "A​B‮C﻿\r\nD";
    expect(normalizeGuestName(piégé)).toBe("ABCD");
  });

  it("resserre les espaces réels sans les supprimer", () => {
    expect(normalizeGuestName("Jean   Luc")).toBe("Jean Luc");
    expect(normalizeGuestName("  Léa  ")).toBe("Léa");
  });

  it("borne la longueur à 20 caractères (pas de dépassement d'affichage ni de buffer)", () => {
    const out = normalizeGuestName("x".repeat(500));
    expect(out).not.toBeNull();
    expect(Array.from(out as string).length).toBe(FAMILY_GUEST_NAME_MAX);
  });

  it("refuse (null) un nom vide une fois nettoyé", () => {
    expect(normalizeGuestName("​​")).toBeNull();
    expect(normalizeGuestName("   ")).toBeNull();
    expect(normalizeGuestName(42 as unknown)).toBeNull();
  });

  it("le nom du compte Jellyfin plie l'ASCII et écarte les caractères que Jellyfin refuse (anti-injection de nom)", () => {
    // < > / : guillemets ne doivent pas survivre dans le nom du compte Jellyfin.
    const name = guestAccountName('Léa<script>"/', "Damien", "fr");
    expect(name).toMatch(/^Lea.* - invite de Damien$/);
    expect(name).not.toMatch(/[<>"/]/);
  });
});

// ── SEC-F-05 : expiration 7 jours ─────────────────────────────────────────────

describe("SEC-F-05 : une invitation expire", () => {
  it("devient « expired » passé son délai, même restée « pending »", () => {
    const expiresAt = 7 * DAY;
    expect(effectiveInvitationStatus({ status: "pending", expiresAt }, expiresAt - 1)).toBe("pending");
    expect(effectiveInvitationStatus({ status: "pending", expiresAt }, expiresAt + 1)).toBe("expired");
  });

  it("ne ressuscite pas une invitation déjà tranchée", () => {
    for (const status of ["accepted", "declined", "cancelled"] as const) {
      expect(effectiveInvitationStatus({ status, expiresAt: 0 }, 1)).toBe(status);
    }
  });
});

// ── SEC-F-14 (part pure) : les interrupteurs cachent les profils ──────────────

describe("SEC-F-14 : ce que les interrupteurs laissent paraître", () => {
  it("coupe membres ET invités quand « families » est éteint", () => {
    const off = { families: false, guests: true };
    expect(isProfileKindAllowed("owner", off)).toBe(true); // le propriétaire reste
    expect(isProfileKindAllowed("member", off)).toBe(false);
    expect(isProfileKindAllowed("guest", off)).toBe(false);
  });

  it("coupe les seuls invités quand « guests » est éteint", () => {
    const on = { families: true, guests: false };
    expect(isProfileKindAllowed("member", on)).toBe(true);
    expect(isProfileKindAllowed("guest", on)).toBe(false);
  });
});
