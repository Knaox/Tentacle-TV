import { describe, expect, it } from "vitest";
import { autoSyncRowShown } from "./settingsRights";

describe("Réglages d'Octave (mobile) — une ligne sans son droit n'existe pas", () => {
  it("« Tenir à jour » : le compte de l'appareil, qui peut garder, face à un serveur qui déclare offline.music", () => {
    expect(autoSyncRowShown({ capable: true, profileSession: false, keepRight: "granted" })).toBe(true);
    expect(autoSyncRowShown({ capable: true, profileSession: false, keepRight: "legacy" })).toBe(true);
  });

  it("absente : serveur qui ne déclare rien, session de profil, droit refusé ou encore inconnu", () => {
    expect(autoSyncRowShown({ capable: false, profileSession: false, keepRight: "granted" })).toBe(false);
    expect(autoSyncRowShown({ capable: true, profileSession: true, keepRight: "granted" })).toBe(false);
    expect(autoSyncRowShown({ capable: true, profileSession: false, keepRight: "refused" })).toBe(false);
    expect(autoSyncRowShown({ capable: true, profileSession: false, keepRight: "unknown" })).toBe(false);
  });
});
