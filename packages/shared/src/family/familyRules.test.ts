import { describe, expect, it } from "vitest";
import {
  FAMILY_DECLINE_COOLDOWN_MS,
  FAMILY_INVITES_PER_DAY,
  FAMILY_MAX_PENDING_PER_INVITEE,
  FAMILY_PIN_LOCK_STEPS_MS,
  FAMILY_PROFILE_COLORS,
} from "./familyContract";
import {
  afterPinFailure,
  canAcceptInvitation,
  capacityError,
  defaultProfileColor,
  effectiveInvitationStatus,
  guestAccountName,
  inviteBlock,
  isPickerRequired,
  isProfileColor,
  isProfileKindAllowed,
  isValidPin,
  normalizeGuestName,
  pinGate,
  pinLockDuration,
  sameUserId,
  selectCandidates,
  type CandidateSource,
  type PinAttemptState,
} from "./familyRules";

const NOW = Date.UTC(2026, 9, 4, 2, 0, 0);

describe("code PIN", () => {
  it("n'accepte que quatre chiffres ASCII", () => {
    expect(isValidPin("0420")).toBe(true);
    for (const bad of ["420", "04200", "04a0", " 0420", "０４２０", 420, null, undefined]) {
      expect(isValidPin(bad)).toBe(false);
    }
  });

  it("bloque au cinquième essai raté, puis de plus en plus longtemps", () => {
    let state: PinAttemptState | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const step = afterPinFailure(state, NOW);
      expect(step.lockedUntil).toBeNull();
      expect(step.attemptsLeft).toBe(5 - attempt);
      state = step.state;
    }
    const fifth = afterPinFailure(state, NOW);
    expect(fifth.lockedUntil).toBe(NOW + FAMILY_PIN_LOCK_STEPS_MS[0]);
    expect(pinGate(fifth.state, NOW + 1)).toEqual({ locked: true, until: NOW + FAMILY_PIN_LOCK_STEPS_MS[0] });

    // Le blocage échu rend cinq essais, mais le suivant dure plus longtemps.
    const later = NOW + FAMILY_PIN_LOCK_STEPS_MS[0];
    expect(pinGate(fifth.state, later)).toEqual({ locked: false, attemptsLeft: 5 });
    let again = fifth.state;
    for (let attempt = 1; attempt <= 4; attempt++) again = afterPinFailure(again, later).state;
    expect(afterPinFailure(again, later).lockedUntil).toBe(later + FAMILY_PIN_LOCK_STEPS_MS[1]);
  });

  it("répète le dernier palier de blocage", () => {
    expect(pinLockDuration(0)).toBe(FAMILY_PIN_LOCK_STEPS_MS[0]);
    expect(pinLockDuration(99)).toBe(FAMILY_PIN_LOCK_STEPS_MS[FAMILY_PIN_LOCK_STEPS_MS.length - 1]);
    expect(pinLockDuration(-1)).toBe(FAMILY_PIN_LOCK_STEPS_MS[0]);
  });

  it("laisse cinq essais à un profil jamais raté", () => {
    expect(pinGate(null, NOW)).toEqual({ locked: false, attemptsLeft: 5 });
  });
});

describe("capacité", () => {
  it("compte le propriétaire et les invitations en attente", () => {
    expect(capacityError("member", { members: 3, guests: 1, pendingInvitations: 0 })).toBeNull();
    expect(capacityError("member", { members: 3, guests: 1, pendingInvitations: 1 })).toBe("family.full");
    expect(capacityError("guest", { members: 0, guests: 3, pendingInvitations: 0 })).toBe("family.guests_full");
    expect(capacityError("guest", { members: 2, guests: 2, pendingInvitations: 1 })).toBe("family.full");
  });

  it("garde sa place à une invitation acceptée", () => {
    expect(canAcceptInvitation({ members: 3, guests: 1 })).toBe(true);
    expect(canAcceptInvitation({ members: 2, guests: 3 })).toBe(false);
  });
});

describe("invitations", () => {
  const empty = { pendingForInvitee: false, lastDeclinedAt: null, sentInLastDay: [], inviteePendingTotal: 0 };

  it("expire une invitation en attente passé sa date", () => {
    expect(effectiveInvitationStatus({ status: "pending", expiresAt: NOW }, NOW)).toBe("expired");
    expect(effectiveInvitationStatus({ status: "pending", expiresAt: NOW + 1 }, NOW)).toBe("pending");
    expect(effectiveInvitationStatus({ status: "declined", expiresAt: NOW - 1 }, NOW)).toBe("declined");
  });

  it("refuse un doublon, puis respecte le délai après un refus", () => {
    expect(inviteBlock({ ...empty, pendingForInvitee: true }, NOW)).toEqual({ code: "family.invite_pending" });
    const declinedAt = NOW - 1000;
    expect(inviteBlock({ ...empty, lastDeclinedAt: declinedAt }, NOW)).toEqual({
      code: "family.invite_cooldown",
      retryAt: declinedAt + FAMILY_DECLINE_COOLDOWN_MS,
    });
    expect(inviteBlock({ ...empty, lastDeclinedAt: NOW - FAMILY_DECLINE_COOLDOWN_MS }, NOW)).toBeNull();
  });

  it("borne les envois sur 24 heures glissantes", () => {
    const sent = Array.from({ length: FAMILY_INVITES_PER_DAY }, (_, i) => NOW - (i + 1) * 60_000);
    expect(inviteBlock({ ...empty, sentInLastDay: sent }, NOW)).toEqual({
      code: "family.invite_quota",
      retryAt: Math.min(...sent) + 24 * 3_600_000,
    });
    const old = sent.map((at) => at - 24 * 3_600_000);
    expect(inviteBlock({ ...empty, sentInLastDay: old }, NOW)).toBeNull();
    expect(inviteBlock({ ...empty, inviteePendingTotal: FAMILY_MAX_PENDING_PER_INVITEE }, NOW)?.code).toBe(
      "family.invite_quota",
    );
  });
});

describe("noms et couleurs", () => {
  it("nettoie le nom affiché d'un invité", () => {
    expect(normalizeGuestName("  Léa​  la   grande ")).toBe("Léa la grande");
    expect(normalizeGuestName("\u0000\u0007")).toBeNull();
    expect(normalizeGuestName(42)).toBeNull();
    expect(Array.from(normalizeGuestName("😀".repeat(30)) ?? "")).toHaveLength(20);
  });

  it("donne au compte Jellyfin un nom ASCII reconnaissable", () => {
    expect(guestAccountName("Léa", "Damien", "fr")).toBe("Lea - invite de Damien");
    expect(guestAccountName("Léa", "Damien", "en", 2)).toBe("Lea - guest of Damien 2");
    expect(guestAccountName("ユキ", "Ōno (TV)", "en")).toBe("Guest - guest of Ono TV");
    expect(guestAccountName("Léa", "Damien", "fr")).toMatch(/^[A-Za-z0-9 \-'._@+]+$/);
  });

  it("tire une couleur stable de l'identifiant", () => {
    const color = defaultProfileColor("4F2A-11");
    expect(isProfileColor(color)).toBe(true);
    expect(defaultProfileColor("4f2a11")).toBe(color);
    expect(isProfileColor("fuchsia")).toBe(false);
    expect(FAMILY_PROFILE_COLORS).toContain(color);
  });

  it("compare les identifiants Jellyfin sans tirets ni casse", () => {
    expect(sameUserId("AB-CD", "abcd")).toBe(true);
    expect(sameUserId("abce", "abcd")).toBe(false);
  });
});

describe("candidats", () => {
  const users: CandidateSource[] = [
    { id: "a", name: "Alice", isHidden: false, isDisabled: false, imageTag: null },
    { id: "b", name: "Béatrice", isHidden: false, isDisabled: false, imageTag: "t" },
    { id: "c", name: "Caché", isHidden: true, isDisabled: false, imageTag: null },
    { id: "d", name: "Désactivé", isHidden: false, isDisabled: true, imageTag: null },
    { id: "e-1", name: "Moi", isHidden: false, isDisabled: false, imageTag: null },
  ];
  const pick = (query: string, exclude: string[] = ["E1"]) =>
    selectCandidates(users, { query, exclude, limit: 50 }).map((user) => user.userId);

  it("liste les comptes visibles, sans désactivés ni exclus", () => {
    expect(pick("")).toEqual(["a", "b"]);
    expect(pick("beat")).toEqual(["b"]);
  });

  it("ne montre un compte caché que par son nom exact", () => {
    expect(pick("Cach")).toEqual([]);
    expect(pick("caché")).toEqual(["c"]);
    expect(pick("cache")).toEqual([]);
  });

  it("borne la liste", () => {
    expect(selectCandidates(users, { query: "", exclude: [], limit: 1 })).toHaveLength(1);
  });
});

describe("la TV", () => {
  it("laisse paraître les profils selon les interrupteurs", () => {
    const on = { families: true, guests: true };
    expect(isProfileKindAllowed("guest", on)).toBe(true);
    expect(isProfileKindAllowed("guest", { families: true, guests: false })).toBe(false);
    expect(isProfileKindAllowed("member", { families: false, guests: true })).toBe(false);
    expect(isProfileKindAllowed("owner", { families: false, guests: false })).toBe(true);
  });

  it("montre « Qui regarde ? » dès deux profils", () => {
    expect(isPickerRequired(1)).toBe(false);
    expect(isPickerRequired(2)).toBe(true);
  });
});
