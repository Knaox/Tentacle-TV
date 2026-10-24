import { describe, expect, it } from "vitest";
import type { MusicSearchResponse } from "../music";
import { externalTrack, libraryAlbum, libraryTrack } from "./fixtures";
import { appendPage, knowledgeOf, recordingsToCheck, visibleSection, type ExternalSection } from "./searchMerge";

const REC = "5b11f4ce-a62d-471e-81fc-a69a8278c7da";
const RG = "1b11f4ce-a62d-471e-81fc-a69a8278c7da";
const mb = (recording: string | null) => ({ recording, release: null, releaseGroup: null, artists: [] });

const empty: ExternalSection = { pluginId: "sillon", label: "Hors", tracks: [], albums: [], artists: [], complete: false };

describe("recherche fusionnée", () => {
  it("les pages s'ajoutent sans doublon, la dernière dit « complet »", () => {
    const t1 = externalTrack("sillon", "1");
    const s1 = appendPage(empty, { query: "x", complete: false, cursor: "c", tracks: [t1], albums: [], artists: [] });
    const s2 = appendPage(s1, { query: "x", complete: true, cursor: null, tracks: [t1, externalTrack("sillon", "2")], albums: [], artists: [] });
    expect(s2.tracks.map((t) => t.key)).toEqual(["ext:sillon:1", "ext:sillon:2"]);
    expect(s2.complete).toBe(true);
  });

  it("la bibliothèque gagne : même enregistrement ou même groupe de parution → retiré", () => {
    const library: MusicSearchResponse = {
      query: "x",
      tracks: [libraryTrack("a", { mbids: mb(REC) })],
      albums: [libraryAlbum("al", { mbids: { release: null, releaseGroup: RG } })],
      artists: [],
      playlists: [],
      tookMs: 3,
    };
    const section: ExternalSection = {
      ...empty,
      tracks: [externalTrack("sillon", "dup", { mbids: mb(REC) }), externalTrack("sillon", "new", { mbids: mb(null) })],
      albums: [{ ...libraryAlbum("x", { mbids: { release: null, releaseGroup: RG } }), key: "ext:sillon:alb", jellyfinId: null }],
    };
    const visible = visibleSection(section, knowledgeOf(library));
    expect(visible.tracks.map((t) => t.key)).toEqual(["ext:sillon:new"]);
    expect(visible.albums).toHaveLength(0);
  });

  it("un enregistrement trouvé ailleurs dans la bibliothèque (by-mbid) est aussi retiré", () => {
    const other = "7b11f4ce-a62d-471e-81fc-a69a8278c7da";
    const section: ExternalSection = { ...empty, tracks: [externalTrack("sillon", "o", { mbids: mb(other) })] };
    const known = knowledgeOf(undefined);
    expect(recordingsToCheck([section], known, new Set())).toEqual([other]);
    expect(recordingsToCheck([section], known, new Set([other]))).toEqual([]);
    expect(visibleSection(section, knowledgeOf(undefined, [other])).tracks).toHaveLength(0);
  });
});
