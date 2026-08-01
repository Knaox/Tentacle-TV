import { describe, expect, it } from "vitest";
import { findMpvTrack, langMatch, nativeSubUrl } from "./mpvTrackMapping";
import type { MpvTrack } from "../../hooks/useDesktopPlayer";

/**
 * Le rang positionnel est ce qui relie une piste Jellyfin à un `sid`/`aid` de
 * mpv. S'il se décale, on pose la mauvaise piste — puis on la corrige après
 * coup, et cette correction fait jeter à mpv tout son cache (mpv#8422). D'où
 * ces cas.
 */

const mpvSubs: MpvTrack[] = [
  { id: 1, type: "sub", lang: "fre", selected: false },
  { id: 2, type: "sub", lang: "eng", selected: false },
];

describe("findMpvTrack — pistes externes", () => {
  it("ne compte pas une externe intercalée dans le rang des internes", () => {
    // Jellyfin : [0 fre INTERNE, 1 fre EXTERNE, 2 eng INTERNE].
    // mpv ne voit que les deux internes → l'anglais est sid 2, pas sid 3.
    const jf = [
      { index: 0, lang: "fre" },
      { index: 1, lang: "fre", external: true },
      { index: 2, lang: "eng" },
    ];
    expect(findMpvTrack(2, jf, mpvSubs)).toBe(2);
  });

  it("rend null pour une piste externe demandée", () => {
    // Elle n'est pas dans la track-list de mpv : l'appelant doit faire un
    // sub-add. Avant, le repli par langue lui substituait l'interne fre (sid 1).
    const jf = [
      { index: 0, lang: "fre" },
      { index: 1, lang: "fre", external: true },
    ];
    expect(findMpvTrack(1, jf, mpvSubs)).toBeNull();
  });

  it("laisse le cas sans externe inchangé", () => {
    const jf = [{ index: 0, lang: "fre" }, { index: 1, lang: "eng" }];
    expect(findMpvTrack(0, jf, mpvSubs)).toBe(1);
    expect(findMpvTrack(1, jf, mpvSubs)).toBe(2);
  });

  it("distingue deux pistes de même langue par leur ordre", () => {
    const deuxFre: MpvTrack[] = [
      { id: 1, type: "sub", lang: "fre", selected: false },
      { id: 2, type: "sub", lang: "fre", selected: false },
    ];
    const jf = [{ index: 0, lang: "fre" }, { index: 1, lang: "fre" }];
    expect(findMpvTrack(1, jf, deuxFre)).toBe(2);
  });

  it("retombe sur le rang quand la langue est inconnue", () => {
    const jf = [{ index: 0 }, { index: 1 }];
    expect(findMpvTrack(1, jf, mpvSubs)).toBe(2);
  });
});

describe("langMatch", () => {
  it("rapproche les variantes ISO 639 d'une même langue", () => {
    expect(langMatch("fr", "fra")).toBe(true);
    expect(langMatch("fre", "fra")).toBe(true);
    expect(langMatch("ger", "deu")).toBe(true);
    expect(langMatch("fre", "eng")).toBe(false);
  });
});

describe("nativeSubUrl", () => {
  it("demande un format que mpv rend, en gardant la query", () => {
    expect(nativeSubUrl("https://x/Subtitles/3/Stream.vtt?api_key=k", "srt"))
      .toBe("https://x/Subtitles/3/Stream.srt?api_key=k");
    expect(nativeSubUrl("https://x/Subtitles/3/Stream.vtt", "ass"))
      .toBe("https://x/Subtitles/3/Stream.ass");
  });
});
