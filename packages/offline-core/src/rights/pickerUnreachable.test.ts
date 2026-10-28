import { describe, expect, it } from "vitest";
import { pickerUnreachableExits } from "./pickerUnreachable";

describe("« Qui regarde ? » sans serveur — jamais bloqué", () => {
  it("toujours : réessayer et se déconnecter", () => {
    const exits = pickerUnreachableExits({ offlineSupported: false, keepRight: "unknown", hasContent: null });
    expect(exits).toEqual({ retry: true, goOffline: false, signOut: true });
  });

  it("hors ligne : seulement avec du contenu gardé par le compte, là où le hors ligne existe", () => {
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "granted", hasContent: true }).goOffline).toBe(true);
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "unknown", hasContent: true }).goOffline).toBe(true);
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "legacy", hasContent: true }).goOffline).toBe(true);
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "granted", hasContent: false }).goOffline).toBe(false);
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "granted", hasContent: null }).goOffline).toBe(false);
    // Le navigateur n'a pas de hors ligne.
    expect(pickerUnreachableExits({ offlineSupported: false, keepRight: "granted", hasContent: true }).goOffline).toBe(false);
  });

  it("un compte à qui le serveur refuse le hors ligne n'y passe pas", () => {
    expect(pickerUnreachableExits({ offlineSupported: true, keepRight: "refused", hasContent: true }).goOffline).toBe(false);
  });
});
