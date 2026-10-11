import { describe, expect, it } from "vitest";
import { MAX_SUBTITLES, collectSubtitleCandidates, orderSubtitles, type YtCaption, type YtCaptions } from "./trailerSubtitles";

const td = (lang: string, extra = "") => `https://www.youtube.com/api/timedtext?v=x&lang=${lang}${extra}`;
const track = (lang: string, name: string, extra = ""): YtCaption[] => [
  { ext: "json3", url: `${td(lang, extra)}&fmt=json3`, name },
  { ext: "srv3", url: `${td(lang, extra)}&fmt=srv3`, name },
  { ext: "vtt", url: `${td(lang, extra)}&fmt=vtt`, name },
];

/** Oppenheimer (relevé du 2026-10-11) : une piste posée en anglais, la reconnaissance vocale et ses traductions. */
const OPPENHEIMER: YtCaptions = {
  subtitles: { en: track("en", "English") },
  automatic_captions: {
    "en-orig": track("en", "English (Original)", "&kind=asr"),
    en: track("en", "English", "&kind=asr"),
    fr: track("en", "French", "&kind=asr&tlang=fr"),
  },
};

/** Une bande-annonce VF (La Femme de ménage) : rien de posé, la reconnaissance vocale en français. */
const VF: YtCaptions = {
  automatic_captions: {
    "fr-orig": track("fr", "French (Original)", "&kind=asr"),
    fr: track("fr", "French", "&kind=asr"),
    en: track("fr", "English", "&kind=asr&tlang=en"),
  },
};

describe("collectSubtitleCandidates", () => {
  it("prend la piste posée avant la reconnaissance vocale de la même langue, en json3", () => {
    const tracks = collectSubtitleCandidates(OPPENHEIMER);
    expect(tracks.map((t) => [t.key, t.auto])).toEqual([["m-en", false]]);
    expect(tracks[0].format).toBe("json3");
    expect(tracks[0].url).toContain("fmt=json3");
  });

  it("garde la reconnaissance vocale d'origine sous son nom, jamais ses traductions (refusées en 429)", () => {
    const tracks = collectSubtitleCandidates(VF);
    expect(tracks.map((t) => [t.key, t.label, t.auto])).toEqual([["a-fr", "French", true]]);
  });

  it("écarte le fil de discussion, les URL hors timedtext (HLS de visionos) et les langues illisibles", () => {
    const tracks = collectSubtitleCandidates({
      subtitles: {
        live_chat: [{ ext: "json", url: "https://www.youtube.com/live_chat" }],
        "../x": track("x", "X"),
        "en-US": [{ ext: "vtt", url: "https://manifest.googlevideo.com/api/manifest/hls_timedtext_playlist/x" }],
        de: [{ ext: "vtt", url: `${td("de")}&fmt=vtt`, name: "German" }],
      },
      automatic_captions: { fr: track("en", "French", "&tlang=fr") },
    });
    expect(tracks.map((t) => [t.key, t.format])).toEqual([["m-de", "vtt"]]);
  });

  it("rien à offrir : liste vide, jamais d'erreur", () => {
    expect(collectSubtitleCandidates({})).toEqual([]);
    expect(collectSubtitleCandidates({ subtitles: { en: undefined } })).toEqual([]);
  });
});

describe("orderSubtitles", () => {
  it("met la langue de l'interface en tête, l'anglais ensuite, une piste posée avant l'automatique", () => {
    const tracks = collectSubtitleCandidates({
      subtitles: { de: track("de", "German"), "en-US": track("en-US", "English"), "fr-FR": track("fr-FR", "French") },
      automatic_captions: { "es-orig": track("es", "Spanish (Original)", "&kind=asr") },
    });
    expect(orderSubtitles(tracks, "fr").map((t) => t.lang)).toEqual(["fr-FR", "en-US", "de", "es"]);
    expect(orderSubtitles(tracks, "fr-CA").map((t) => t.lang)).toEqual(["fr-FR", "en-US", "de", "es"]);
    expect(orderSubtitles(tracks, undefined).map((t) => t.lang)).toEqual(["en-US", "de", "fr-FR", "es"]);
  });

  it("une piste posée avant une automatique, et une liste bornée", () => {
    const many: YtCaptions = { subtitles: Object.fromEntries(["de", "es", "it", "ja", "ko", "pt", "nl", "fr"].map((l) => [l, track(l, l)])) };
    const ordered = orderSubtitles(collectSubtitleCandidates(many), "fr");
    expect(ordered).toHaveLength(MAX_SUBTITLES);
    expect(ordered[0].lang).toBe("fr");
    expect(ordered.slice(1).map((t) => t.lang)).toEqual(["de", "es", "it", "ja", "ko"]);
  });
});
