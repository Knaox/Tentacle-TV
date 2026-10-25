import { describe, expect, it } from "vitest";
import { octaveLanding, parseOctaveStartup, startupWantsOctave, type OctaveStartupChoice } from "./octaveStartup";

/**
 * Octave — la règle du démarrage : trois choix × le dernier mode × Octave
 * disponible, indisponible ou pas encore connu. On n'arrive dans Octave que
 * s'il peut s'ouvrir ; on ne peint rien tant qu'on ne le sait pas.
 */

const AVAILABLE = { available: true, settled: true };
const UNAVAILABLE = { available: false, settled: true };
const UNKNOWN = { available: false, settled: false };

const landing = (choice: OctaveStartupChoice, last: boolean, availability: typeof AVAILABLE) =>
  octaveLanding(startupWantsOctave(choice, last), availability);

describe("démarrage d'Octave", () => {
  it.each`
    choice        | last     | available       | expected
    ${"last"}     | ${true}  | ${AVAILABLE}    | ${"octave"}
    ${"last"}     | ${true}  | ${UNAVAILABLE}  | ${"tentacle"}
    ${"last"}     | ${true}  | ${UNKNOWN}      | ${"pending"}
    ${"last"}     | ${false} | ${AVAILABLE}    | ${"tentacle"}
    ${"last"}     | ${false} | ${UNAVAILABLE}  | ${"tentacle"}
    ${"last"}     | ${false} | ${UNKNOWN}      | ${"tentacle"}
    ${"octave"}   | ${true}  | ${AVAILABLE}    | ${"octave"}
    ${"octave"}   | ${true}  | ${UNAVAILABLE}  | ${"tentacle"}
    ${"octave"}   | ${true}  | ${UNKNOWN}      | ${"pending"}
    ${"octave"}   | ${false} | ${AVAILABLE}    | ${"octave"}
    ${"octave"}   | ${false} | ${UNAVAILABLE}  | ${"tentacle"}
    ${"octave"}   | ${false} | ${UNKNOWN}      | ${"pending"}
    ${"tentacle"} | ${true}  | ${AVAILABLE}    | ${"tentacle"}
    ${"tentacle"} | ${true}  | ${UNAVAILABLE}  | ${"tentacle"}
    ${"tentacle"} | ${true}  | ${UNKNOWN}      | ${"tentacle"}
    ${"tentacle"} | ${false} | ${AVAILABLE}    | ${"tentacle"}
    ${"tentacle"} | ${false} | ${UNAVAILABLE}  | ${"tentacle"}
    ${"tentacle"} | ${false} | ${UNKNOWN}      | ${"tentacle"}
  `("$choice, dernier mode Octave = $last, $available.available/$available.settled → $expected", ({ choice, last, available, expected }) => {
    expect(landing(choice, last, available)).toBe(expected);
  });

  it("« Tentacle seul » n'attend jamais la disponibilité d'Octave", () => {
    expect(octaveLanding(startupWantsOctave("tentacle", true), UNKNOWN)).toBe("tentacle");
  });

  it("une valeur inconnue ou absente vaut « dernier mode utilisé » (appareil d'avant ce réglage)", () => {
    expect(parseOctaveStartup(null)).toBe("last");
    expect(parseOctaveStartup(undefined)).toBe("last");
    expect(parseOctaveStartup("")).toBe("last");
    expect(parseOctaveStartup("music")).toBe("last");
    expect(parseOctaveStartup("octave")).toBe("octave");
    expect(parseOctaveStartup("tentacle")).toBe("tentacle");
  });
});
