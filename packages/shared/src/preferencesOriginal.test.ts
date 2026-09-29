import { describe, expect, it } from "vitest";
import { ORIGINAL_AUDIO_LANG, originalAudioIndex, resolveMediaTracks } from "./preferences";

const pref = (audioLang: string | null) => ({ jellyfinUserId: "u", libraryId: "l", audioLang, subtitleLang: null, subtitleMode: "none" as const });
// Doublage en première piste (par défaut), VO ensuite — l'épisode de Cowboy Bebop du banc.
const AUDIO = [
  { index: 1, language: "fra", isDefault: true },
  { index: 2, language: "jpn" },
];

describe("préférence « VO » (langue originale)", () => {
  it("sans langue originale connue, la piste que le fichier marque originale", () => {
    expect(originalAudioIndex([AUDIO[0], { ...AUDIO[1], isOriginal: true }], null)).toBe(2);
  });

  it("la langue originale du titre prime sur le drapeau d'une autre piste (règle de Jellyfin 12)", () => {
    expect(originalAudioIndex([AUDIO[0], { ...AUDIO[1], isOriginal: true }], "fr")).toBe(1);
  });

  it("parmi les pistes de la langue originale, celle que le fichier marque", () => {
    const commentary = { index: 3, language: "jpn", title: "Commentaire" };
    expect(originalAudioIndex([AUDIO[0], commentary, { ...AUDIO[1], isOriginal: true }], "ja")).toBe(2);
  });

  it("faute de piste dans la langue originale, la piste marquée", () => {
    expect(originalAudioIndex([AUDIO[0], { ...AUDIO[1], isOriginal: true }], "ko")).toBe(2);
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
