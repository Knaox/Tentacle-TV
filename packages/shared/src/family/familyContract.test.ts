import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/family";
import en from "../i18n/locales/en/family";
import { FAMILY_ERROR_STATUS, FAMILY_NOTIFICATION_TYPES, type FamilyErrorCode } from "./familyProtocol";
import { FAMILY_ROUTES, familyPath, splitFamilyPath, type FamilyRouteName } from "./familyRoutes";
import {
  familyErrorKey,
  familyErrorOf,
  familyNotificationKey,
  isFamilyNotificationType,
  isProfileEndedReply,
} from "./familyLabels";

const CODES = Object.keys(FAMILY_ERROR_STATUS) as FamilyErrorCode[];
const ROUTES = Object.keys(FAMILY_ROUTES) as FamilyRouteName[];

describe("table des routes", () => {
  it("n'a jamais deux routes au même couple méthode + chemin", () => {
    const seen = new Set(ROUTES.map((name) => `${FAMILY_ROUTES[name].method} ${FAMILY_ROUTES[name].path}`));
    expect(seen.size).toBe(ROUTES.length);
  });

  it("réserve les gestes personnels aux sessions personnelles", () => {
    for (const name of ["acceptInvite", "declineInvite", "snoozeInvite", "leave", "setOwnPin", "dissolve", "setGuestPin"] as const) {
      expect(FAMILY_ROUTES[name].callers).toEqual(["personal"]);
    }
  });

  it("ne laisse le jeton de jumelage QUE lister, ouvrir un profil et s'échanger", () => {
    const withPairing = ROUTES.filter((name) => (FAMILY_ROUTES[name].callers as readonly string[]).includes("tvPairing"));
    expect(withPairing.sort()).toEqual(["tvEnroll", "tvOpenSession", "tvProfiles"]);
    const withLegacy = ROUTES.filter((name) => (FAMILY_ROUTES[name].callers as readonly string[]).includes("tvLegacy"));
    expect(withLegacy).toEqual(["tvEnroll"]);
  });

  it("remplit et encode les paramètres, refuse un paramètre manquant", () => {
    expect(familyPath("acceptInvite", { id: "a/b" })).toBe("/api/family/invitations/a%2Fb/accept");
    expect(familyPath("overview")).toBe("/api/family");
    expect(() => familyPath("deleteGuest")).toThrow(/userId/);
  });

  it("range chaque route sous son préfixe", () => {
    expect(splitFamilyPath("/api/family")).toEqual({ prefix: "/api/family", rest: "/" });
    expect(splitFamilyPath("/api/family/tv/sessions")).toEqual({ prefix: "/api/family", rest: "/tv/sessions" });
    expect(splitFamilyPath("/api/admin/family")).toEqual({ prefix: "/api/admin", rest: "/family" });
  });
});

describe("refus du serveur", () => {
  it("lit un corps JSON, en texte ou en objet", () => {
    const raw = JSON.stringify({ code: "family.pin_invalid", message: "PIN", attemptsLeft: 3 });
    expect(familyErrorOf(raw)).toEqual({ code: "family.pin_invalid", message: "PIN", attemptsLeft: 3 });
    expect(familyErrorOf({ code: "family.pairing_required", message: "", revoked: true })?.revoked).toBe(true);
  });

  it("ignore tout ce qui n'est pas un refus de la Famille", () => {
    expect(familyErrorOf("Unauthorized")).toBeNull();
    expect(familyErrorOf({ message: "Invalid token" })).toBeNull();
    expect(familyErrorOf({ code: "family.inconnu" })).toBeNull();
    expect(familyErrorOf({ code: "constructor" })).toBeNull();
  });

  it("reconnaît la fin d'une session de profil, distincte d'un déjumelage", () => {
    expect(isProfileEndedReply(JSON.stringify({ message: "", revoked: true, profileEnded: true }))).toBe(true);
    expect(isProfileEndedReply({ message: "Appareil révoqué", revoked: true })).toBe(false);
    expect(isProfileEndedReply("pas du JSON")).toBe(false);
  });

  it("donne une clé i18n à chaque code", () => {
    expect(familyErrorKey("family.pin_locked")).toBe("family:errors.pin_locked");
  });
});

describe("vocabulaire", () => {
  it("traduit chaque code d'erreur et chaque notification, en français et en anglais", () => {
    for (const code of CODES) {
      const key = code.slice("family.".length) as keyof typeof fr.errors;
      expect(fr.errors[key], code).toBeTruthy();
      expect(en.errors[key as keyof typeof en.errors], code).toBeTruthy();
    }
    for (const type of FAMILY_NOTIFICATION_TYPES) {
      expect(isFamilyNotificationType(type)).toBe(true);
      expect(familyNotificationKey(type)).toBe(`family:notifications.${type}`);
      expect(fr.notifications[type]).toContain("{{name}}");
      expect(en.notifications[type]).toContain("{{name}}");
    }
    expect(Object.keys(fr.errors).sort()).toEqual(Object.keys(en.errors).sort());
  });

  it("n'écrit jamais « téléchargement » : le mobile lit cet espace", () => {
    const text = JSON.stringify([fr, en]).toLowerCase();
    for (const word of ["télécharg", "download"]) expect(text).not.toContain(word);
  });
});
