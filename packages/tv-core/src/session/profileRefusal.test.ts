import { describe, expect, it } from "vitest";

import { profileRefusalOf, refusalReloadsProfiles } from "./profileRefusal";
import {
  PIN_ENTRY_START,
  erasePinDigit,
  pinEntryFor,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  pressPinDigit,
  type PinEntry,
} from "./pinEntry";

const NOW = Date.parse("2026-10-04T22:00:00Z");

describe("les refus du serveur de la Famille", () => {
  it("lit un PIN faux, requis ou bloqué", () => {
    expect(profileRefusalOf(403, '{"code":"family.pin_invalid","message":"","attemptsLeft":3}')).toEqual({ kind: "pinInvalid", attemptsLeft: 3 });
    expect(profileRefusalOf(403, { code: "family.pin_required", message: "" })).toEqual({ kind: "pinRequired" });
    expect(profileRefusalOf(423, { code: "family.pin_locked", message: "", lockedUntil: "2026-10-04T22:15:00Z" }))
      .toEqual({ kind: "locked", until: "2026-10-04T22:15:00Z" });
  });

  it("ne déjumelle que sur un jumelage RÉVOQUÉ", () => {
    expect(profileRefusalOf(401, { code: "family.pairing_required", message: "", revoked: true })).toEqual({ kind: "unpaired" });
    expect(profileRefusalOf(401, { code: "family.pairing_required", message: "" })).toEqual({ kind: "failed", code: "family.pairing_required" });
    expect(profileRefusalOf(401, '{"message":"Appareil révoqué","revoked":true}')).toEqual({ kind: "unpaired" });
    // Une session de profil terminée ramène à « Qui regarde ? », jamais au jumelage.
    expect(profileRefusalOf(401, { message: "", revoked: true, profileEnded: true })).toEqual({ kind: "ended" });
    expect(profileRefusalOf(401, { message: "Token invalide" })).toEqual({ kind: "failed", code: null });
  });

  it("relit la liste quand le profil n'est plus ouvrable ici", () => {
    const unavailable = profileRefusalOf(403, { code: "family.profile_unavailable", message: "" });
    expect(unavailable).toEqual({ kind: "unavailable" });
    expect(refusalReloadsProfiles(unavailable)).toBe(true);
    const guests = profileRefusalOf(403, { code: "family.guests_disabled", message: "" });
    expect(guests).toEqual({ kind: "disabled", code: "family.guests_disabled" });
    expect(refusalReloadsProfiles(guests)).toBe(true);
    expect(refusalReloadsProfiles({ kind: "pinInvalid", attemptsLeft: 2 })).toBe(false);
  });

  it("un serveur muet, saturé ou coupé ne conclut rien", () => {
    expect(profileRefusalOf(0, null)).toEqual({ kind: "offline" });
    expect(profileRefusalOf(503, "Service Unavailable")).toEqual({ kind: "offline" });
    expect(profileRefusalOf(429, { message: "Rate limit" })).toEqual({ kind: "offline" });
    expect(profileRefusalOf(503, { code: "family.jellyfin_unavailable", message: "" })).toEqual({ kind: "offline" });
  });

  it("dit l'échange à faire et la gestion refermée", () => {
    expect(profileRefusalOf(409, { code: "family.enroll_required", message: "" })).toEqual({ kind: "enroll" });
    expect(profileRefusalOf(403, { code: "family.manage_locked", message: "" })).toEqual({ kind: "manageLocked" });
    expect(profileRefusalOf(409, { code: "family.full", message: "" })).toEqual({ kind: "failed", code: "family.full" });
  });
});

describe("le pavé du code PIN", () => {
  const type = (entry: PinEntry, digits: string) => {
    let current = entry;
    let submit: string | null = null;
    for (const digit of digits) ({ entry: current, submit } = pressPinDigit(current, digit as "1"));
    return { entry: current, submit };
  };

  it("envoie le code au quatrième chiffre, une fois, puis ne prend plus rien", () => {
    const { entry, submit } = type(PIN_ENTRY_START, "1234");
    expect(submit).toBe("1234");
    expect(entry.phase).toBe("checking");
    expect(pressPinDigit(entry, "5")).toEqual({ entry, submit: null });
    expect(erasePinDigit(entry)).toBe(entry);
  });

  it("efface le dernier chiffre", () => {
    const { entry } = type(PIN_ENTRY_START, "12");
    expect(erasePinDigit(entry).digits).toBe("1");
    expect(erasePinDigit(PIN_ENTRY_START).digits).toBe("");
  });

  it("un code faux vide le pavé et dit les essais restants ; le chiffre suivant recommence", () => {
    const sent = type(PIN_ENTRY_START, "1234").entry;
    const wrong = pinRefused(sent, { kind: "pinInvalid", attemptsLeft: 2 });
    expect(wrong).toEqual({ digits: "", phase: "wrong", attemptsLeft: 2, lockedUntil: null });
    expect(pressPinDigit(wrong, "9").entry).toEqual({ digits: "9", phase: "typing", attemptsLeft: 2, lockedUntil: null });
  });

  it("bloqué, il se tait jusqu'à l'heure dite, puis se rouvre", () => {
    const locked = pinRefused(type(PIN_ENTRY_START, "0000").entry, { kind: "locked", until: "2026-10-04T22:15:00Z" });
    expect(locked.phase).toBe("locked");
    expect(pressPinDigit(locked, "1").submit).toBeNull();
    expect(pinLockRemainingMs(locked, NOW)).toBe(15 * 60_000);
    expect(pinLockLapsed(locked, NOW)).toBeNull();
    expect(pinLockLapsed(locked, NOW + 15 * 60_000)).toEqual(PIN_ENTRY_START);
  });

  it("un profil déjà bloqué ouvre le pavé bloqué", () => {
    expect(pinEntryFor("2026-10-04T23:00:00Z", NOW).phase).toBe("locked");
    expect(pinEntryFor("2026-10-04T21:00:00Z", NOW)).toEqual(PIN_ENTRY_START);
    expect(pinEntryFor(null, NOW)).toEqual(PIN_ENTRY_START);
  });
});
