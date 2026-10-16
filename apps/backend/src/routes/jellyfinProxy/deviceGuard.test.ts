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
