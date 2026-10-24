import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("koffi", () => ({ default: {} }));

import { DEFAULT_OUTPUT, fourcc, resetScanForTests, scanAudioComponents, type FindNextAsync } from "./coreAudioScan";

afterEach(() => resetScanForTests());

describe("recensement des composants audio au lancement", () => {
  it("vise la sortie par défaut d'Apple, celle qu'ouvre mpv", () => {
    expect(fourcc("auou")).toBe(0x61756f75);
    expect(DEFAULT_OUTPUT).toMatchObject({ componentType: 0x61756f75, componentSubType: 0x64656620, componentManufacturer: 0x6170706c });
  });

  it("macOS : un appel ASYNCHRONE, une seule fois par processus, sa durée rendue", () => {
    const calls: unknown[] = [];
    const pending: Array<(e: unknown) => void> = [];
    const find: FindNextAsync = (description, done) => {
      calls.push(description);
      pending.push(done);
    };
    let clock = 100;
    const done = vi.fn();
    expect(scanAudioComponents("darwin", done, () => find, () => clock)).toBe(true);
    expect(done).not.toHaveBeenCalled();
    expect(scanAudioComponents("darwin", done, () => find, () => clock)).toBe(false);
    clock = 2100;
    pending[0]?.(null);
    expect(done).toHaveBeenCalledWith(2000);
    expect(calls).toEqual([DEFAULT_OUTPUT]);
  });

  it("Windows et Linux : rien", () => {
    const load = vi.fn();
    expect(scanAudioComponents("win32", undefined, load)).toBe(false);
    expect(scanAudioComponents("linux", undefined, load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("une panne (bibliothèque introuvable, erreur native) ne lève jamais", () => {
    const done = vi.fn();
    expect(() => scanAudioComponents("darwin", done, () => { throw new Error("introuvable"); })).not.toThrow();
    expect(done).toHaveBeenCalledWith(null);
    resetScanForTests();
    const failing: FindNextAsync = (_d, cb) => cb(new Error("native"));
    scanAudioComponents("darwin", done, () => failing);
    expect(done).toHaveBeenLastCalledWith(null);
  });
});
