import { describe, expect, it } from "vitest";
import { ORIGINAL_AUDIO_LANG, originalAudioIndex, resolveMediaTracks } from "./preferences";

const pref = (audioLang: string | null) => ({ jellyfinUserId: "u", libraryId: "l", audioLang, subtitleLang: null, subtitleMode: "none" as const });
// Doublage en première piste (par défaut), VO ensuite — l'épisode de Cowboy Bebop du banc.
const AUDIO = [
  { index: 1, language: "fra", isDefault: true },
  { index: 2, language: "jpn" },
];

describe("préférence « VO » (langue originale)", () => {
  it("la piste marquée originale par Jellyfin 12 l'emporte", () => {
    expect(originalAudioIndex([AUDIO[0], { ...AUDIO[1], isOriginal: true }], "fr")).toBe(2);
  });

  it("sinon la langue originale du titre, codes ISO 639-1 contre 639-2", () => {
    expect(resolveMediaTracks(pref(ORIGINAL_AUDIO_LANG), AUDIO, [], "ja").audioIndex).toBe(2);
  });

  it("sans langue originale connue (Jellyfin d'avant 12), la piste par défaut du fichier", () => {
    expect(resolveMediaTracks(pref(ORIGINAL_AUDIO_LANG), AUDIO, []).audioIndex).toBe(1);
    expect(resolveMediaTracks(pref(ORIGINAL_AUDIO_LANG), AUDIO, [], "ko").audioIndex).toBe(1);
  });

  it("n'altère pas une préférence de langue précise", () => {
    expect(resolveMediaTracks(pref("jpn"), AUDIO, [], "fr").audioIndex).toBe(2);
    expect(resolveMediaTracks(pref("fre"), AUDIO, [], "ja").audioIndex).toBe(1);
  });
});
