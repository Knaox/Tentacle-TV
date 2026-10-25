import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Octave — le mode au LANCEMENT : décidé une fois, au chargement du module,
 * par « Au démarrage, ouvrir » appliqué au dernier mode ; le résultat devient
 * le dernier mode du lancement suivant. Clés d'appareil, jamais renommées.
 */

const disk = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => disk.get(k) ?? null,
  setItem: (k: string, v: string) => void disk.set(k, v),
  removeItem: (k: string) => void disk.delete(k),
};

async function launch(keys: Record<string, string>) {
  disk.clear();
  for (const [k, v] of Object.entries(keys)) disk.set(k, v);
  vi.resetModules();
  return import("./octaveMode");
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lancement", () => {
  it("appareil neuf : Tentacle", async () => {
    const m = await launch({});
    expect(m.isOctaveMode()).toBe(false);
  });

  it("appareil d'avant le réglage, Octave laissé allumé : Octave (rien ne change)", async () => {
    const m = await launch({ tentacle_octave_mode: "1" });
    expect(m.isOctaveMode()).toBe(true);
    expect(disk.get("tentacle_octave_mode")).toBe("1");
  });

  it("« Tentacle » : Tentacle même si Octave était allumé, et c'est désormais le dernier mode", async () => {
    const m = await launch({ tentacle_octave_mode: "1", tentacle_octave_startup: "tentacle" });
    expect(m.isOctaveMode()).toBe(false);
    expect(disk.has("tentacle_octave_mode")).toBe(false);
  });

  it("« Octave » : Octave même si l'on était dans Tentacle", async () => {
    const m = await launch({ tentacle_octave_startup: "octave" });
    expect(m.isOctaveMode()).toBe(true);
    expect(disk.get("tentacle_octave_mode")).toBe("1");
  });

  it("la bascule reste telle quelle au lancement suivant (« dernier mode »)", async () => {
    let m = await launch({});
    m.setOctaveMode(true);
    m = await launch(Object.fromEntries(disk));
    expect(m.isOctaveMode()).toBe(true);
    m.setOctaveMode(false);
    m = await launch(Object.fromEntries(disk));
    expect(m.isOctaveMode()).toBe(false);
  });

  it("stockage refusé : aucun plantage, Tentacle", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("refusé"); } });
    vi.resetModules();
    const m = await import("./octaveMode");
    expect(m.isOctaveMode()).toBe(false);
  });
});

describe("réglage « Au démarrage, ouvrir »", () => {
  it("le défaut ne s'écrit pas ; les autres choix se gardent", async () => {
    disk.clear();
    vi.resetModules();
    const s = await import("./octaveStartupStore");
    expect(s.getOctaveStartup()).toBe("last");
    s.setOctaveStartup("octave");
    expect(disk.get("tentacle_octave_startup")).toBe("octave");
    s.setOctaveStartup("last");
    expect(disk.has("tentacle_octave_startup")).toBe(false);
  });
});
