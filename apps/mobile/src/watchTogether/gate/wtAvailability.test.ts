import { describe, expect, it } from "vitest";
import { wtAvailability } from "./wtAvailability";

describe("wtAvailability", () => {
  it("serveur sans l'adhésion par appareil : aucune trace, même avec tous les droits", () => {
    expect(wtAvailability(false, { mayJoin: true, mayCreate: true })).toEqual({ enabled: false, mayCreate: false });
  });

  it("compte « interdit » (ou invité de la Famille) : aucune trace", () => {
    expect(wtAvailability(true, { mayJoin: false, mayCreate: false })).toEqual({ enabled: false, mayCreate: false });
  });

  it("« rejoindre seulement » : présent, sans création", () => {
    expect(wtAvailability(true, { mayJoin: true, mayCreate: false })).toEqual({ enabled: true, mayCreate: false });
  });

  it("accès complet", () => {
    expect(wtAvailability(true, { mayJoin: true, mayCreate: true })).toEqual({ enabled: true, mayCreate: true });
  });
});
