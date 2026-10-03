import { describe, expect, it } from "vitest";
import { pairingBackAction } from "./screenBack";

describe("Retour sur une étape du jumelage", () => {
  it("recule d'une étape, comme la croix", () => {
    expect(pairingBackAction("relayCode")).toBe("toWelcome");
    expect(pairingBackAction("manualServer")).toBe("toWelcome");
    expect(pairingBackAction("manualLogin")).toBe("toServer");
    expect(pairingBackAction("manualCode")).toBe("toLogin");
  });

  it("l'accueil et le succès n'ont pas de couche : la plateforme quitte", () => {
    expect(pairingBackAction("welcome")).toBeNull();
    expect(pairingBackAction("success")).toBeNull();
  });
});
