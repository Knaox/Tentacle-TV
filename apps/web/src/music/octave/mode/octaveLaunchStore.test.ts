import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Octave — le lancement en Octave, décidé au chargement : il retient
 * Tentacle (sélecteur, recouvrements, préchargements des films) jusqu'à sa
 * première image ; le miroir de disponibilité n'apprend que des réponses.
 */

const disk = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => disk.get(k) ?? null,
  setItem: (k: string, v: string) => void disk.set(k, v),
  removeItem: (k: string) => void disk.delete(k),
};
const USER = JSON.stringify({ Id: "u1", Name: "octave1" });

async function launch(keys: Record<string, string>) {
  disk.clear();
  for (const [k, v] of Object.entries(keys)) disk.set(k, v);
  vi.resetModules();
  return import("./octaveLaunchStore");
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("au lancement", () => {
  it("Octave allumé, un compte : lancement en Octave, Tentacle retenu", async () => {
    const s = await launch({ tentacle_octave_mode: "1", tentacle_user: USER });
    expect(s.wasLaunchedInOctave()).toBe(true);
    expect(s.isTentacleHeld()).toBe(true);
  });

  it("la première image de Tentacle relâche tout, une fois pour la session", async () => {
    const s = await launch({ tentacle_octave_mode: "1", tentacle_user: USER });
    s.releaseTentacle();
    s.releaseTentacle();
    expect(s.isTentacleHeld()).toBe(false);
    expect(s.wasLaunchedInOctave()).toBe(true);
  });

  it("rien de retenu : Tentacle au lancement, ou sans compte", async () => {
    expect((await launch({ tentacle_user: USER })).isTentacleHeld()).toBe(false);
    expect((await launch({ tentacle_octave_mode: "1" })).isTentacleHeld()).toBe(false);
    expect((await launch({ tentacle_octave_mode: "1", tentacle_user: USER, tentacle_octave_startup: "tentacle" })).isTentacleHeld()).toBe(false);
  });

  it("Octave déjà connu indisponible pour ce compte : lancement ordinaire", async () => {
    const mirror = JSON.stringify({ owner: "|u1", available: false });
    const s = await launch({ tentacle_octave_mode: "1", tentacle_user: USER, tentacle_octave_launch: mirror });
    expect(s.isTentacleHeld()).toBe(false);
  });
});

describe("le miroir de la disponibilité", () => {
  it("s'écrit pour l'identité gardée, sans réécrire ce qu'il sait déjà", async () => {
    const s = await launch({ tentacle_user: USER });
    s.noteOctaveAvailability(true);
    expect(JSON.parse(disk.get("tentacle_octave_launch")!)).toEqual({ owner: "|u1", available: true });
    s.forgetOctaveLaunchMirror();
    expect(disk.has("tentacle_octave_launch")).toBe(false);
  });

  it("sans compte, rien ; un miroir illisible ne vaut rien", async () => {
    const s = await launch({ tentacle_octave_launch: "{pas du json" });
    expect(s.readOctaveLaunchMirror()).toBeNull();
    s.noteOctaveAvailability(true);
    expect(disk.get("tentacle_octave_launch")).toBe("{pas du json");
  });
});
