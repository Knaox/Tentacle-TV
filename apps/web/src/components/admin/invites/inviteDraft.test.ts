/**
 * Le formulaire « Nouvelle invitation » : ce qui part au serveur, et ce qui
 * est refusé avant — plus jamais de NaN envoyé tel quel.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT, resolveDraft, type InviteDraft } from "./inviteDraft";

const draft = (over: Partial<InviteDraft>): InviteDraft => ({ ...DEFAULT_DRAFT, ...over });

describe("resolveDraft", () => {
  it("les réglages par défaut : une personne, trois jours", () => {
    expect(resolveDraft(DEFAULT_DRAFT)).toEqual({ ok: true, request: { maxUses: 1, expiresInHours: 72 } });
  });

  it("un préréglage part tel quel", () => {
    expect(resolveDraft(draft({ uses: 10, expiryHours: 30 * 24 }))).toEqual({
      ok: true, request: { maxUses: 10, expiresInHours: 720 },
    });
  });

  it("la saisie libre compte en heures ou en jours", () => {
    expect(resolveDraft(draft({ expiryHours: "custom", customExpiry: "12", customUnit: "hours" }))).toEqual({
      ok: true, request: { maxUses: 1, expiresInHours: 12 },
    });
    expect(resolveDraft(draft({ uses: "custom", customUses: " 42 ", expiryHours: "custom", customExpiry: "14", customUnit: "days" }))).toEqual({
      ok: true, request: { maxUses: 42, expiresInHours: 336 },
    });
  });

  it("refuse un nombre de personnes vide, nul, décimal ou au-delà de 100", () => {
    for (const customUses of ["", "0", "2,5", "1e3", "101", "-3"]) {
      expect(resolveDraft(draft({ uses: "custom", customUses })), customUses).toMatchObject({ ok: false, usesError: "range" });
    }
  });

  it("refuse une durée vide ou nulle, et au-delà de 30 jours", () => {
    expect(resolveDraft(draft({ expiryHours: "custom", customExpiry: "" }))).toMatchObject({ ok: false, expiryError: "invalid" });
    expect(resolveDraft(draft({ expiryHours: "custom", customExpiry: "0", customUnit: "hours" }))).toMatchObject({ ok: false, expiryError: "invalid" });
    expect(resolveDraft(draft({ expiryHours: "custom", customExpiry: "31", customUnit: "days" }))).toMatchObject({ ok: false, expiryError: "tooLong" });
    expect(resolveDraft(draft({ expiryHours: "custom", customExpiry: "721", customUnit: "hours" }))).toMatchObject({ ok: false, expiryError: "tooLong" });
  });

  it("signale les deux fautes à la fois", () => {
    expect(resolveDraft(draft({ uses: "custom", customUses: "", expiryHours: "custom", customExpiry: "" }))).toEqual({
      ok: false, usesError: "range", expiryError: "invalid",
    });
  });
});
