import { describe, expect, it } from "vitest";
import { shouldAutoSubmitPairingCode } from "./usePairingAutoSubmit";

describe("shouldAutoSubmitPairingCode — le dernier caractère valide le jumelage", () => {
  it("part dès que les 4 caractères sont là, au repos", () => {
    expect(shouldAutoSubmitPairingCode("AB12", "idle", null)).toBe(true);
  });

  it("attend tant que le code est incomplet", () => {
    expect(shouldAutoSubmitPairingCode("AB1", "idle", null)).toBe(false);
    expect(shouldAutoSubmitPairingCode("", "idle", null)).toBe(false);
  });

  it("ne relance pas pendant un jumelage, après une réussite ni après un refus", () => {
    expect(shouldAutoSubmitPairingCode("AB12", "pairing", null)).toBe(false);
    expect(shouldAutoSubmitPairingCode("AB12", "success", null)).toBe(false);
    expect(shouldAutoSubmitPairingCode("AB12", "error", null)).toBe(false);
  });

  it("une seule tentative par code : le même code déjà tenté ne repart pas seul", () => {
    expect(shouldAutoSubmitPairingCode("AB12", "idle", "AB12")).toBe(false);
    expect(shouldAutoSubmitPairingCode("AB13", "idle", "AB12")).toBe(true);
  });
});
