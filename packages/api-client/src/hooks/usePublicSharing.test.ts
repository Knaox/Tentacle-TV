import { describe, expect, it } from "vitest";
import { publicSharingAllowed, shareErrorCode } from "./useShareLink";

/** « Partager Ma liste » ne paraît que si le compte en a le droit — ou face à un serveur d'avant, comme avant. */
describe("le droit « Partage public » côté client", () => {
  it("rien tant que la configuration n'a pas répondu", () => {
    expect(publicSharingAllowed(false, false, undefined)).toBe(false);
    expect(publicSharingAllowed(false, true, true)).toBe(false);
  });

  it("serveur sans la capacité : comme avant, permis", () => {
    expect(publicSharingAllowed(true, false, undefined)).toBe(true);
  });

  it("serveur qui la déclare : la réponse de /access, rien tant qu'elle n'est pas là", () => {
    expect(publicSharingAllowed(true, true, undefined)).toBe(false);
    expect(publicSharingAllowed(true, true, false)).toBe(false);
    expect(publicSharingAllowed(true, true, true)).toBe(true);
  });

  it("lit le code d'un refus, et rien d'autre", () => {
    expect(shareErrorCode(new Error('{"error":"share_unavailable","message":"Lien indisponible"}'))).toBe("share_unavailable");
    expect(shareErrorCode(new Error("Lien introuvable"))).toBeNull();
    expect(shareErrorCode("share_unavailable")).toBeNull();
  });
});
