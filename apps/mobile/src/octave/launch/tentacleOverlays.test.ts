import { describe, expect, it } from "vitest";
import { startupOverlayAllowed, tentacleHeldNow, TENTACLE_OVERLAYS_HELD_IN_OCTAVE } from "./tentacleOverlays";

describe("recouvrements de démarrage de Tentacle face à Octave", () => {
  it("en mode Octave (entrée en cours de session, iPad compris) : Tentacle est retenu", () => {
    expect(tentacleHeldNow({ octaveMode: true, launchedInOctave: false, released: false })).toBe(true);
  });

  it("au démarrage instantané en Octave : retenu, même avant que le mode soit relu", () => {
    expect(tentacleHeldNow({ octaveMode: false, launchedInOctave: true, released: false })).toBe(true);
  });

  it("de retour dans Tentacle : plus rien de retenu", () => {
    expect(tentacleHeldNow({ octaveMode: false, launchedInOctave: true, released: true })).toBe(false);
    expect(tentacleHeldNow({ octaveMode: false, launchedInOctave: false, released: false })).toBe(false);
  });

  it("retenu : ni invitation aux avatars, ni affiche Famille, ni premier lancement, ni conseil PIN, ni avertissements", () => {
    for (const key of ["avatars", "family", "firstRun", "familyPin", "notices"] as const) {
      expect(startupOverlayAllowed(key, true)).toBe(false);
      expect(startupOverlayAllowed(key, false)).toBe(true);
    }
  });

  it("ce qui n'est pas « de Tentacle » passe toujours : sécurité, messages, migration, accès, hors ligne, permission", () => {
    for (const key of ["profiles", "messages", "migration", "access", "connectivity", "permission"] as const) {
      expect(startupOverlayAllowed(key, true)).toBe(true);
    }
    expect(TENTACLE_OVERLAYS_HELD_IN_OCTAVE).not.toContain("profiles");
  });
});
