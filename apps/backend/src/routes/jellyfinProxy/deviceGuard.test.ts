/**
 * Le garde complet d'un jeton d'appareil : son périmètre (un seul compte, le
 * sien) PUIS ce qu'il peut écrire. La photo du compte (galerie des avatars de
 * la TV, 1.30.0) n'est permise que pour SON compte — jamais celui d'un autre,
 * même écrit autrement.
 */

import { describe, expect, it } from "vitest";
import { deviceRefusal } from "./deviceGuard";

const ME = "0123456789abcdef0123456789abcdef";
const ME_DASHED = "01234567-89ab-cdef-0123-456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

const GUEST = "aaaabbbbccccddddeeeeffff00001111";
const MEMBER = "11112222333344445555666677778888";

describe("la session de profil d'une TV (invité comme membre) ne pose que SA photo", () => {
  it.each([
    ["un invité", GUEST, MEMBER],
    ["un invité", GUEST, ME],
    ["un membre", MEMBER, GUEST],
    ["un membre", MEMBER, ME],
  ])("%s ne pose jamais la photo d'un autre compte", (_who, session, other) => {
    expect(deviceRefusal("POST", `Users/${other}/Images/Primary`, session, {})).toMatch(/perimetre/);
  });

  it.each([["un invité", GUEST], ["un membre", MEMBER]])("%s pose la sienne", (_who, session) => {
    expect(deviceRefusal("POST", `Users/${session}/Images/Primary`, session, {})).toBeNull();
  });
});

describe("la photo d'un AUTRE compte, en lecture (membres d'une séance de Watch Together)", () => {
  it("se lit — Jellyfin la sert sans jeton —, quelle que soit la casse", () => {
    expect(deviceRefusal("GET", `Users/${OTHER}/Images/Primary`, ME, { tag: "abc", maxWidth: "96" })).toBeNull();
    expect(deviceRefusal("HEAD", `users/${OTHER}/images/primary`, ME, {})).toBeNull();
  });

  it("ne s'écrit jamais, et l'exception ne couvre rien d'autre du compte", () => {
    expect(deviceRefusal("POST", `Users/${OTHER}/Images/Primary`, ME, {})).toMatch(/perimetre/);
    expect(deviceRefusal("GET", `Users/${OTHER}/Items`, ME, {})).toMatch(/perimetre/);
    expect(deviceRefusal("GET", `Users/${OTHER}/Views`, ME, {})).toMatch(/perimetre/);
  });
});

describe("la photo du compte depuis un appareil", () => {
  it("passe pour son propre compte, quelle que soit la forme de l'identifiant", () => {
    expect(deviceRefusal("POST", `Users/${ME}/Images/Primary`, ME, {})).toBeNull();
    expect(deviceRefusal("POST", `Users/${ME_DASHED}/Images/Primary`, ME, {})).toBeNull();
    expect(deviceRefusal("POST", `users/${ME.toUpperCase()}/images/primary`, ME, {})).toBeNull();
  });

  it("est refusée pour un autre compte", () => {
    expect(deviceRefusal("POST", `Users/${OTHER}/Images/Primary`, ME, {})).toMatch(/perimetre/);
    // Un `userId` en query ne fait pas changer de compte non plus.
    expect(deviceRefusal("POST", `Users/${ME}/Images/Primary`, ME, { userId: OTHER })).toMatch(/perimetre/);
  });

  it("ne permet ni de la retirer ni de toucher aux images d'un titre", () => {
    expect(deviceRefusal("DELETE", `Users/${ME}/Images/Primary`, ME, {})).toMatch(/ecriture/);
    expect(deviceRefusal("POST", "Users/Me/Images/Primary", ME, {})).toMatch(/ecriture/);
    expect(deviceRefusal("POST", `Items/${OTHER}/Images/Primary`, ME, {})).toMatch(/ecriture/);
  });
});
