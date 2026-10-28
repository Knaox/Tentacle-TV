import { describe, expect, it } from "vitest";
import { offlineSwitchOf, type OfflineSwitchInputs } from "./offlineSwitchRule";

/**
 * Octave — « Passer hors ligne » / « Revenir en ligne » (Damien, 28/10 : « il n'y a pas de moyen de passer en mode
 * hors ligne facilement ») : seulement là où le hors ligne existe, jamais une session de profil, et la sortie toujours.
 */
const base: OfflineSwitchInputs = { desktop: true, state: "online", profileSession: false, surfaceVisible: true, hasPlayable: true };
const kind = (patch: Partial<OfflineSwitchInputs>) => offlineSwitchOf({ ...base, ...patch });

describe("passer hors ligne depuis Octave", () => {
  it("en ligne, sur le bureau, le compte de l'appareil avec de la musique gardée : « Passer hors ligne »", () => {
    expect(kind({})).toBe("goOffline");
  });

  it("le web : rien, dans aucun état", () => {
    for (const state of ["online", "checking", "offline-auto", "offline-manual"] as const) expect(kind({ desktop: false, state })).toBeNull();
  });

  it("une session de profil : jamais « Passer hors ligne »", () => {
    expect(kind({ profileSession: true })).toBeNull();
    expect(kind({ profileSession: true, state: "offline-auto" })).toBeNull();
  });

  it("sans la porte de la musique gardée (droit refusé, serveur d'avant) : rien", () => {
    expect(kind({ surfaceVisible: false })).toBeNull();
  });

  it("rien de gardé en entier : rien — Octave hors ligne renverrait à l'accueil des films", () => {
    expect(kind({ hasPlayable: false })).toBeNull();
  });

  it("hors ligne par choix : « Revenir en ligne », TOUJOURS — même la porte refermée, même un profil", () => {
    expect(kind({ state: "offline-manual" })).toBe("goOnline");
    expect(kind({ state: "offline-manual", surfaceVisible: false, hasPlayable: false })).toBe("goOnline");
    expect(kind({ state: "offline-manual", profileSession: true })).toBe("goOnline");
  });

  it("hors ligne subi : « Réessayer » ; pendant la première sonde : rien", () => {
    expect(kind({ state: "offline-auto" })).toBe("retry");
    expect(kind({ state: "checking" })).toBeNull();
  });
});
