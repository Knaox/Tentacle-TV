import { describe, expect, it } from "vitest";
import { MUSIC_RIGHTS_BEFORE, type MusicRights } from "@tentacle-tv/shared/music";
import { mayOfferAcquire, quotaExhausted, remainingToTell } from "./acquireRules";

const limited = (dailyLimit: number, remainingToday: number): MusicRights => ({ acquire: true, dailyLimit, remainingToday, keepOffline: true, resetsAt: 1 });

describe("droits d'ajout d'Octave", () => {
  it("extension d'avant : le bouton reste, rien n'est compté ni dit", () => {
    expect(mayOfferAcquire(MUSIC_RIGHTS_BEFORE)).toBe(true);
    expect(quotaExhausted(MUSIC_RIGHTS_BEFORE)).toBe(false);
    expect(remainingToTell(MUSIC_RIGHTS_BEFORE)).toBeNull();
  });

  it("sans le droit d'ajouter : pas de bouton", () => {
    expect(mayOfferAcquire({ ...MUSIC_RIGHTS_BEFORE, acquire: false })).toBe(false);
  });

  it("le reste se dit en approchant de la limite : un cinquième, au moins 2, au plus 5", () => {
    expect(remainingToTell(limited(50, 6))).toBeNull();
    expect(remainingToTell(limited(50, 5))).toBe(5);
    expect(remainingToTell(limited(10, 3))).toBeNull();
    expect(remainingToTell(limited(10, 2))).toBe(2);
    expect(remainingToTell(limited(3, 2))).toBe(2);
    expect(remainingToTell(limited(3, 0))).toBeNull();
  });

  it("à zéro : le geste se refuse sans attendre le serveur", () => {
    expect(quotaExhausted(limited(5, 0))).toBe(true);
    expect(quotaExhausted(limited(5, 1))).toBe(false);
    expect(quotaExhausted({ ...MUSIC_RIGHTS_BEFORE, remainingToday: null })).toBe(false);
  });
});
