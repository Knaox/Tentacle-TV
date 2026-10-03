import { describe, expect, it } from "vitest";
import { loginErrorReclaim, pairingEntryKey } from "./pairingFocus";

describe("entrée d'une étape du jumelage", () => {
  it("l'action principale de chaque étape", () => {
    expect(pairingEntryKey({ kind: "welcome" })).toBe("pairing:showCode");
    expect(pairingEntryKey({ kind: "manualServer" })).toBe("pairing:url");
    expect(pairingEntryKey({ kind: "manualLogin", error: null })).toBe("pairing:username");
    expect(pairingEntryKey({ kind: "success" })).toBeNull();
  });

  it("un refus de connexion rend le focus au mot de passe", () => {
    expect(pairingEntryKey({ kind: "manualLogin", error: { reason: "invalid" } })).toBe("pairing:password");
  });

  it("le code du relais affiché ou en préparation : la croix, seule action", () => {
    expect(pairingEntryKey({ kind: "relayCode", code: { status: "loading" } })).toBe("pairing:back");
    expect(pairingEntryKey({ kind: "relayCode", code: { status: "active" } })).toBe("pairing:back");
  });

  it("le code du serveur affiché : « Changer de serveur »", () => {
    expect(pairingEntryKey({ kind: "serverCode", code: { status: "active" } })).toBe("pairing:changeServer");
    expect(pairingEntryKey({ kind: "serverCode", code: { status: "loading" } })).toBe("pairing:changeServer");
  });

  it("un code en échec ou expiré : réessayer, en régénérer un", () => {
    expect(pairingEntryKey({ kind: "relayCode", code: { status: "error" } })).toBe("pairing:retry");
    expect(pairingEntryKey({ kind: "serverCode", code: { status: "expired" } })).toBe("pairing:regenerate");
  });
});

describe("refus de connexion", () => {
  it("l'identifiant qui reprend le focus le rend au mot de passe ; rien d'autre", () => {
    expect(loginErrorReclaim("pairing:username")).toBe("pairing:password");
    expect(loginErrorReclaim("pairing:password")).toBeNull();
    expect(loginErrorReclaim("pairing:signIn")).toBeNull();
  });
});
