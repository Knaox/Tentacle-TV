import { describe, expect, it } from "vitest";
import {
  AUDIO_RETRY_DELAYS_MS, AUDIO_TRANSIENT_ERROR, audioRetryDelay, classifyAvPlayerError, isAudioTransientError,
} from "./playerErrors";

describe("classifyAvPlayerError — la sortie audio passagèrement indisponible", () => {
  it("la trace relevée au simulateur (« Alléger ») : à rejouer, pas un master refusé", () => {
    const text = "The operation couldn’t be completed. (CoreMediaErrorDomain error -66681.)";
    expect(classifyAvPlayerError({ code: -66681, text, loopback: true })).toBe("audioTransient");
  });

  it("-66681 porté par le code : à rejouer, même sur le flux de PrismCore", () => {
    expect(classifyAvPlayerError({ code: -66681, text: "", loopback: true })).toBe("audioTransient");
    expect(classifyAvPlayerError({ code: -66681, text: "", loopback: false })).toBe("audioTransient");
  });

  it("-66681 enrobé dans un -11800 (dit seulement dans la raison) : à rejouer, pas un format", () => {
    const text = "The operation could not be completed — An unknown error occurred (-66681)";
    expect(classifyAvPlayerError({ code: -11800, text, loopback: false })).toBe("audioTransient");
    expect(classifyAvPlayerError({ code: -11800, text, loopback: true })).toBe("audioTransient");
  });

  it("la famille : sortie changée, serveur audio ou services média redémarrés", () => {
    for (const code of [-66680, -66671, -66665, -11819]) {
      expect(classifyAvPlayerError({ code, text: "", loopback: true })).toBe("audioTransient");
    }
  });
});

describe("classifyAvPlayerError — le reste ne change pas", () => {
  it("le flux de PrismCore refusé pour autre chose : la forme muxée, puis le transcodage", () => {
    expect(classifyAvPlayerError({ code: -11868, text: "", loopback: true })).toBe("masterRejected");
    expect(classifyAvPlayerError({ code: -16170, text: "", loopback: true })).toBe("masterRejected");
    expect(classifyAvPlayerError({ code: -11800, text: "An unknown error occurred (-12860)", loopback: true })).toBe("masterRejected");
  });

  it("hors PrismCore : un format illisible reste un format", () => {
    expect(classifyAvPlayerError({ code: -11828, text: "", loopback: false })).toBe("format");
    expect(classifyAvPlayerError({ code: -11800, text: "", loopback: false })).toBe("format");
    expect(classifyAvPlayerError({ code: undefined, text: "Cannot Open", loopback: false })).toBe("format");
  });

  it("hors PrismCore, le reste est dit tel quel", () => {
    expect(classifyAvPlayerError({ code: -1004, text: "Could not connect to the server.", loopback: false })).toBe("other");
  });

  it("un nombre du texte qui n'est pas un code ne trompe pas", () => {
    expect(classifyAvPlayerError({ code: -1004, text: "port 66681 refused", loopback: false })).toBe("other");
  });
});

describe("le marqueur et le budget", () => {
  it("le marqueur se reconnaît, code compris", () => {
    expect(isAudioTransientError(`${AUDIO_TRANSIENT_ERROR} code=-66681`)).toBe(true);
    expect(isAudioTransientError("PRISM_MASTER_REJECTED")).toBe(false);
  });

  it("trois tentatives de plus en plus espacées, jamais tout de suite, puis l'erreur est dite", () => {
    expect(AUDIO_RETRY_DELAYS_MS.map((_, attempt) => audioRetryDelay(attempt))).toEqual([1500, 4000, 8000]);
    expect(audioRetryDelay(3)).toBeNull();
    expect(audioRetryDelay(-1)).toBeNull();
  });
});
