import { describe, expect, it } from "vitest";
import { resolveMediaTracks, type LibraryPreference } from "@tentacle-tv/shared";
import {
  buildLocalSubtitleTracks,
  isForcedTrack,
  isSideCarIndex,
  parseSideCarFileName,
  SIDECAR_INDEX_BASE,
  type LabelContext,
} from "./localPlaybackTrackSources";
import type { MpvTrack } from "./useDesktopPlayer";

const ctx: LabelContext = { locale: "fr", fallbackFor: (i) => `Piste ${i}` };

const sub = (id: number, extra: Partial<MpvTrack> = {}): MpvTrack => ({
  id, type: "sub", selected: false, ...extra,
});

describe("parseSideCarFileName", () => {
  it("lit index, langue et drapeaux", () => {
    expect(parseSideCarFileName("3-fre-forced.srt")).toEqual({
      jfIndex: 3, lang: "fre", forced: true, sdh: false, format: "srt",
    });
    expect(parseSideCarFileName("12-eng-sdh.ass")).toEqual({
      jfIndex: 12, lang: "eng", forced: false, sdh: true, format: "ass",
    });
    expect(parseSideCarFileName("4-fr-be.vtt")?.lang).toBe("fr");
  });

  it("rejette ce qui n'est pas un side-car", () => {
    expect(parseSideCarFileName("original-ms1.mkv")).toBeNull();
    expect(parseSideCarFileName("notes.txt")).toBeNull();
  });
});

describe("buildLocalSubtitleTracks", () => {
  it("fusionne pistes internes et side-cars dans des espaces d'index disjoints", () => {
    const tracks = buildLocalSubtitleTracks(
      [sub(1, { lang: "fre" }), sub(2, { lang: "eng" })],
      [{ absolutePath: "/dl/media/x/subs/5-fre-forced.srt", fileName: "5-fre-forced.srt" }],
      ctx,
    );
    expect(tracks).toHaveLength(3);
    expect(tracks[0].index).toBe(1);
    expect(tracks[2].index).toBe(SIDECAR_INDEX_BASE + 5);
    // Un side-car est reconnaissable à son seul index.
    expect(isSideCarIndex(tracks[0].index)).toBe(false);
    expect(isSideCarIndex(tracks[2].index)).toBe(true);
    // L'interne n'a pas d'URL (mpv la lit par sid), le side-car porte son chemin.
    expect(tracks[0].url).toBe("");
    expect(tracks[2].url).toBe("/dl/media/x/subs/5-fre-forced.srt");
  });

  it("ne double pas un side-car déjà chargé par sub-add", () => {
    // Après sub-add, mpv liste la piste externe : elle vient du même fichier.
    const tracks = buildLocalSubtitleTracks(
      [sub(1, { lang: "fre" }), sub(3, { lang: "fre", external: true })],
      [{ absolutePath: "/dl/media/x/subs/5-fre.srt", fileName: "5-fre.srt" }],
      ctx,
    );
    expect(tracks).toHaveLength(2);
    expect(tracks.map((t) => t.index)).toEqual([1, SIDECAR_INDEX_BASE + 5]);
  });

  it("étiquette les side-cars lisiblement", () => {
    const [track] = buildLocalSubtitleTracks(
      [],
      [{ absolutePath: "/x/3-fre-forced.srt", fileName: "3-fre-forced.srt" }],
      ctx,
    );
    expect(track.label).toBe("Français — Forced - SRT");
    expect(isForcedTrack(track)).toBe(true);
  });

  it("variante Allégée : les side-cars sont la seule source", () => {
    const tracks = buildLocalSubtitleTracks(
      [],
      [
        { absolutePath: "/x/2-fre.srt", fileName: "2-fre.srt" },
        { absolutePath: "/x/3-eng.srt", fileName: "3-eng.srt" },
      ],
      ctx,
    );
    expect(tracks.map((t) => t.label)).toEqual(["Français - SRT", "Anglais - SRT"]);
  });
});

describe("résolution des préférences hors ligne", () => {
  const pref = (over: Partial<LibraryPreference> = {}): LibraryPreference => ({
    jellyfinUserId: "u", libraryId: "lib", audioLang: "fre", subtitleLang: null,
    subtitleMode: "none", ...over,
  });
  // Ce que fait useLocalPlaybackTracks : couper la région avant le matching.
  const base = (lang?: string) => lang?.split("-")[0].toLowerCase();

  it("associe une piste régionale « fr-BE » à la préférence « fre »", () => {
    const { audioIndex } = resolveMediaTracks(
      pref(),
      [
        { index: 1, language: base("en"), isDefault: true, title: "Anglais" },
        { index: 2, language: base("fr-BE"), isDefault: false, title: "Français (Belgique)" },
      ],
      [],
    );
    expect(audioIndex).toBe(2);
  });

  it("choisit un side-car quand aucune piste interne ne convient", () => {
    const subs = buildLocalSubtitleTracks(
      [],
      [{ absolutePath: "/x/3-fre.srt", fileName: "3-fre.srt" }],
      ctx,
    );
    const { subtitleIndex } = resolveMediaTracks(
      pref({ subtitleLang: "fre", subtitleMode: "always" }),
      [{ index: 1, language: "fre", isDefault: true, title: "Français" }],
      subs.map((t) => ({
        index: t.index, language: base(t.lang), isForced: isForcedTrack(t), title: t.label,
      })),
    );
    expect(subtitleIndex).toBe(SIDECAR_INDEX_BASE + 3);
  });

  it("mode « forcés » : retient la piste forcée, pas la complète", () => {
    const subs = buildLocalSubtitleTracks(
      [sub(1, { lang: "fre" }), sub(2, { lang: "fre", forced: true })],
      [],
      ctx,
    );
    const { subtitleIndex } = resolveMediaTracks(
      pref({ subtitleLang: "fre", subtitleMode: "forced" }),
      [{ index: 1, language: "jpn", isDefault: true, title: "Japonais" }],
      subs.map((t) => ({
        index: t.index, language: base(t.lang), isForced: isForcedTrack(t), title: t.label,
      })),
    );
    expect(subtitleIndex).toBe(2);
  });

  it("mode « désactivés » : aucun sous-titre", () => {
    const { subtitleIndex } = resolveMediaTracks(
      pref({ subtitleMode: "none", subtitleLang: "fre" }),
      [{ index: 1, language: "fre", isDefault: true, title: "Français" }],
      [{ index: 2, language: "fre", isForced: false, title: "Français" }],
    );
    expect(subtitleIndex).toBeNull();
  });
});
