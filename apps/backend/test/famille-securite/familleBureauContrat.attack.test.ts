/**
 * Tests d'attaque — invariants de SÉCURITÉ portés par le CONTRAT des profils
 * du BUREAU (`src/family/familyRoutes.ts` picker*, `familyPickerContract.ts`,
 * `serverCapabilities.ts`, `familyProtocol.ts`). Serveur NON requis : la TABLE
 * doit dire ce que la sécurité exige — c'est la première barrière, celle qui
 * devient rouge si quelqu'un élargit un jour les appelants de `picker*`, glisse
 * un identifiant dans une URL journalisée, ou ouvre la liste des plateformes.
 *
 * Le COMPORTEMENT (session de profil qui regarde, IDOR de profil, PIN partagé,
 * révocation, proxy borné) vit chez l'agent C — `familleBureau.attack.test.ts`
 * et `familleBureauProxy.attack.test.ts` — et, en complément d'isolation, dans
 * `familleBureauIsolation.attack.test.ts`. Ici, rien que le contrat.
 *
 * Exigences E (lot du 14/10) : SEC-F-46 (appelant), SEC-F-52 (plateforme
 * fermée), SEC-F-53 (capacité), et « rien de secret dans une URL ».
 */

import { describe, expect, it } from "vitest";
import { FAMILY_ROUTES, type FamilyRouteName } from "../../src/family/familyRoutes";
import { FAMILY_ERROR_STATUS } from "../../src/family/familyProtocol";
import { FAMILY_PICKER_PLATFORMS, isPickerPlatform } from "../../src/family/familyPickerContract";
// Le backend ne dépend pas de `@tentacle-tv/shared` : on lit SON miroir.
import { SERVER_CAPABILITIES } from "../../src/serverCapabilities/serverCapabilities";

const PICKER_ROUTES: FamilyRouteName[] = ["pickerProfiles", "pickProfile", "pickerPreference", "setPickerPreference"];

// ── SEC-F-46 : « Qui regarde ? » du bureau — session PERSONNELLE SEULE ────────

describe("SEC-F-46 (contrat) : les routes picker n'autorisent QUE la session personnelle", () => {
  it.each(PICKER_ROUTES)("%s a pour seul appelant « personal »", (name) => {
    // Jamais tvProfile (une session de profil ne choisit pas un autre profil),
    // jamais tvPairing/tvLegacy (ce n'est pas une TV), jamais ownerTv/memberTv/admin.
    expect(FAMILY_ROUTES[name].callers).toEqual(["personal"]);
  });
});

// ── Rien de secret (PIN, profil) dans une URL journalisée ─────────────────────

describe("les routes picker ne portent aucun identifiant ni secret dans leur chemin", () => {
  it.each(PICKER_ROUTES)("%s : chemin sous /api/family/picker/, sans paramètre « :… »", (name) => {
    expect(FAMILY_ROUTES[name].path).not.toMatch(/:[A-Za-z]/);
    expect(FAMILY_ROUTES[name].path.startsWith("/api/family/picker/")).toBe(true);
  });
  it("choisir un profil et régler la préférence passent par le CORPS (POST/PUT) : le PIN n'est jamais en query ni en chemin", () => {
    expect(FAMILY_ROUTES.pickProfile.method).toBe("POST");
    expect(FAMILY_ROUTES.setPickerPreference.method).toBe("PUT");
  });
  it("choisir un profil est borné par adresse (anti-spam, SEC-F-48 versant débit)", () => {
    expect(FAMILY_ROUTES.pickProfile.rateLimit?.max).toBeGreaterThan(0);
  });
});

// ── SEC-F-52 : plateforme d'une LISTE FERMÉE ──────────────────────────────────

describe("SEC-F-52 (contrat) : la plateforme de « Qui regarde ? » est une liste fermée", () => {
  it("le bureau, rien d'autre aujourd'hui", () => {
    expect(FAMILY_PICKER_PLATFORMS).toEqual(["desktop"]);
  });
  it("toute autre valeur est rejetée (le serveur rend family.invalid_input)", () => {
    for (const other of ["web", "mobile", "tv", "", "__proto__", "constructor", "desktop ", "DESKTOP", null, 1]) {
      expect(isPickerPlatform(other)).toBe(false);
    }
    expect(FAMILY_ERROR_STATUS["family.invalid_input"]).toBe(400);
  });
});

// ── SEC-F-53 : capacité family.desktopProfiles ────────────────────────────────

describe("SEC-F-53 (contrat) : la capacité porte la version qui livre le bureau", () => {
  it("family.desktopProfiles arrive en 1.28.0 (un serveur d'avant n'a pas les routes)", () => {
    expect(SERVER_CAPABILITIES["family.desktopProfiles"]).toBe("1.28.0");
  });
});

// ── Les codes de refus du bureau existent (contrat partagé) ───────────────────

describe("les refus des profils du bureau sont des codes connus, aux bons statuts", () => {
  it.each([
    ["family.personal_session_required", 403], // SEC-F-46 : pas une session de profil
    ["family.profile_unavailable", 403],       // SEC-F-47 : profil hors famille
    ["family.pin_required", 403],              // SEC-F-48
    ["family.pin_invalid", 403],               // SEC-F-48
    ["family.pin_locked", 423],                // SEC-F-48 : blocage partagé
    ["family.invalid_input", 400],             // SEC-F-52
    ["family.disabled", 403],                  // Familles coupées
    ["family.guests_disabled", 403],           // Profils invités coupés
    ["family.guest_account", 403],             // un invité n'a pas de « Qui regarde ? »
  ] as const)("%s → %i", (code, status) => {
    expect(FAMILY_ERROR_STATUS[code]).toBe(status);
  });
});
