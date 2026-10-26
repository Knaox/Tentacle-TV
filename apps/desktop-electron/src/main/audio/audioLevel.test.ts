/**
 * Le niveau du son pour la houle d'Octave : un filtre de MESURE (jamais en mode exclusif), une valeur lue
 * qui traverse le pont en nombre fini.
 */

import { describe, expect, it } from "vitest";
import { LEVEL_FILTER, LEVEL_LABEL, LEVEL_PROPERTY, SILENCE_DB, levelFilterOption, parseLevel } from "./audioLevel";
import { startOptions } from "./audioOptions";

const START = { serverOrigin: "http://s", headers: {}, volume: 1, muted: false, replayGain: "auto" as const, deviceId: null, exclusive: false };

describe("audioLevel", () => {
  it("un filtre étiqueté, qui ne mesure que le RMS d'ensemble, lu par son étiquette", () => {
    expect(LEVEL_FILTER.startsWith(`@${LEVEL_LABEL}:lavfi=[astats=`)).toBe(true);
    expect(LEVEL_FILTER).toContain("metadata=1");
    expect(LEVEL_FILTER).toContain("measure_perchannel=none");
    expect(LEVEL_PROPERTY).toBe(`af-metadata/${LEVEL_LABEL}/lavfi.astats.Overall.RMS_level`);
  });

  it("jamais en mode exclusif (sortie bit pour bit)", () => {
    expect(levelFilterOption(false)).toEqual({ af: LEVEL_FILTER });
    expect(levelFilterOption(true)).toEqual({});
    expect(startOptions("darwin", START, "", {}).af).toBe(LEVEL_FILTER);
    expect(startOptions("darwin", { ...START, exclusive: true }, "", {}).af).toBeUndefined();
  });

  it("le banc garde la main sur la chaîne (options en plus)", () => {
    expect(startOptions("darwin", START, "", { af: "" }).af).toBe("");
  });

  it("lit les dBFS, le silence en plancher fini, et rien d'une valeur absente ou illisible", () => {
    expect(parseLevel("-18.420000")).toBeCloseTo(-18.42);
    expect(parseLevel("-inf")).toBe(SILENCE_DB);
    expect(parseLevel("-500")).toBe(SILENCE_DB);
    expect(parseLevel("3")).toBe(0);
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("nan")).toBeNull();
  });
});
