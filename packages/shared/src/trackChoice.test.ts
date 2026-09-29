import { describe, expect, it } from "vitest";
import type { MediaStream } from "./types/media";
import { itemTrackChoiceFromStreams } from "./trackChoice";

const streams = [
  { Type: "Audio", Index: 1, Language: "jpn", Codec: "aac", IsDefault: true },
  { Type: "Audio", Index: 2, Language: "fre", Codec: "aac", IsDefault: false },
  { Type: "Subtitle", Index: 3, Language: "fre", Codec: "subrip", IsDefault: false, IsForced: true, DisplayTitle: "Français - Forced" },
  { Type: "Subtitle", Index: 4, Language: "fre", Codec: "subrip", IsDefault: false, Title: "Signs & Songs" },
  { Type: "Subtitle", Index: 5, Language: "eng", Codec: "subrip", IsDefault: false },
] as MediaStream[];

describe("itemTrackChoiceFromStreams", () => {
  it("retient des langues, jamais des index, et le mode d'après la piste", () => {
    expect(itemTrackChoiceFromStreams(streams, 2, null)).toEqual({ audioLang: "fre", subtitleLang: null, subtitleMode: "none" });
    expect(itemTrackChoiceFromStreams(streams, 1, 3)).toEqual({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "forced" });
    expect(itemTrackChoiceFromStreams(streams, 1, 4)).toEqual({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "signs" });
    expect(itemTrackChoiceFromStreams(streams, 1, 5)).toEqual({ audioLang: "jpn", subtitleLang: "eng", subtitleMode: "always" });
  });

  // Jellyfin 12 nomme les pistes dans la langue de la requête : « Forcé » en
  // fin de mot doit valoir « Forced », sans que « forcément » ne s'y trompe.
  it("reconnaît « Forcé » dans un titre en français, pas « forcément »", () => {
    const french = [
      streams[0],
      { Type: "Subtitle", Index: 6, Language: "eng", Codec: "subrip", IsDefault: false, DisplayTitle: "English - Forcé - SUBRIP" },
      { Type: "Subtitle", Index: 7, Language: "fre", Codec: "subrip", IsDefault: false, Title: "Pas forcément utile" },
    ] as MediaStream[];
    expect(itemTrackChoiceFromStreams(french, 1, 6).subtitleMode).toBe("forced");
    expect(itemTrackChoiceFromStreams(french, 1, 7).subtitleMode).toBe("always");
  });

  it("un index inconnu ne casse rien", () => {
    expect(itemTrackChoiceFromStreams(streams, 99, -1)).toEqual({ audioLang: null, subtitleLang: null, subtitleMode: "none" });
  });
});
