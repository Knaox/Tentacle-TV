import { describe, expect, it } from "vitest";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { trackChoiceOf } from "./trackChoice";

/**
 * Défaut F du relevé : ce que « Appliquer à cette série » enregistre. Avant,
 * un sous-titre externe en lecture locale (index +1000) donnait une langue
 * vide, et une piste forcée devenait « toujours ».
 */

const audio = (Index: number, Language: string): JfStream => ({ Index, Language, Type: "Audio" }) as JfStream;
const sub = (Index: number, Language: string, extra: Partial<JfStream> = {}): JfStream =>
  ({ Index, Language, Type: "Subtitle", ...extra }) as JfStream;

describe("trackChoiceOf", () => {
  const streams = [audio(1, "jpn"), audio(2, "fre"), sub(3, "fre"), sub(4, "fre", { IsForced: true }), sub(5, "eng", { Title: "Signs & Songs" })];

  it("lit les langues des pistes Jellyfin", () => {
    expect(trackChoiceOf({ streams, audioIndex: 1, subtitleIndex: 3 })).toEqual({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" });
    expect(trackChoiceOf({ streams, audioIndex: 2, subtitleIndex: null })).toEqual({ audioLang: "fre", subtitleLang: null, subtitleMode: "none" });
  });

  it("garde le mode de la piste : forcés, panneaux", () => {
    expect(trackChoiceOf({ streams, audioIndex: 2, subtitleIndex: 4 }).subtitleMode).toBe("forced");
    expect(trackChoiceOf({ streams, audioIndex: 1, subtitleIndex: 5 }).subtitleMode).toBe("signs");
  });

  it("retrouve la langue d'un sous-titre externe indexé à +1000 par le flux d'origine", () => {
    expect(trackChoiceOf({ streams, audioIndex: 1, subtitleIndex: 1003 })).toEqual({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" });
    expect(trackChoiceOf({ streams, audioIndex: 1, subtitleIndex: 1004 }).subtitleMode).toBe("forced");
  });

  it("sans flux (aucun DTO), la lit dans le nom du side-car", () => {
    const sideCars = [{ fileName: "3-fre.srt" }, { fileName: "7-eng-forced.ass" }, { fileName: "9-und.srt" }];
    expect(trackChoiceOf({ streams: [], audioIndex: 1, subtitleIndex: 1003, sideCars })).toEqual({ audioLang: null, subtitleLang: "fre", subtitleMode: "always" });
    expect(trackChoiceOf({ streams: [], audioIndex: 1, subtitleIndex: 1007, sideCars })).toEqual({ audioLang: null, subtitleLang: "eng", subtitleMode: "forced" });
    expect(trackChoiceOf({ streams: [], audioIndex: 1, subtitleIndex: 1009, sideCars }).subtitleLang).toBeNull();
  });
});
