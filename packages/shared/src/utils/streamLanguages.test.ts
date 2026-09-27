import { describe, expect, it } from "vitest";
import type { MediaStream } from "../types/media";
import { normalizeLanguageCode, streamLanguages } from "./streamLanguages";

const s = (Type: MediaStream["Type"], Language?: string) => ({ Type, Language, Index: 0 }) as MediaStream;

describe("streamLanguages", () => {
  it("ramène les codes bibliographiques à deux lettres ; « und » ne dit rien", () => {
    expect(normalizeLanguageCode("fre")).toBe("fr");
    expect(normalizeLanguageCode("GER")).toBe("de");
    expect(normalizeLanguageCode("und")).toBeNull();
    expect(normalizeLanguageCode("pt-br")).toBe("pt-br");
    expect(normalizeLanguageCode("xx1")).toBeNull();
  });

  it("des noms dans la langue de l'interface, sans doublon, par type de piste", () => {
    const streams = [s("Video"), s("Audio", "fre"), s("Audio", "eng"), s("Audio", "fra"), s("Subtitle", "eng")];
    expect(streamLanguages(streams, "Audio", "fr")).toEqual(["Français", "Anglais"]);
    expect(streamLanguages(streams, "Subtitle", "en")).toEqual(["English"]);
    expect(streamLanguages(undefined, "Audio", "fr")).toEqual([]);
  });
});
