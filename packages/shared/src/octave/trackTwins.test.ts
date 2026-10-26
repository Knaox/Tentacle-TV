import { describe, expect, it } from "vitest";
import { sameRecording, sameTrack } from "./trackTwins";
import { externalTrack, libraryTrack } from "./testing";

const OST = { title: "Cyberpunk: Edgerunners 2 (Original Series Soundtrack)", mbid: null, jellyfinId: null };
const own = libraryTrack("a", { title: "Worth It", artists: [{ name: "Various Artists", mbid: null, jellyfinId: null }], album: OST, durationMs: 161_984 });
const theirs = (over: Parameters<typeof externalTrack>[2] = {}) =>
  externalTrack("sillon", "w", { title: "Worth It", artists: [{ name: "Corbin", mbid: null, jellyfinId: null }], album: OST, durationMs: 162_000, ...over });

describe("jumeaux : la règle du contrat, pour la recherche, les likés et les doublons de playlist", () => {
  it("une compilation « Various Artists » : même album, même durée", () => {
    expect(sameTrack(own, theirs())).toBe(true);
    expect(sameRecording(own, theirs())).toBe(true);
  });

  it("la même tolérance partout : ± 2 s", () => {
    expect(sameRecording(own, theirs({ durationMs: 163_900 }))).toBe(true);
    expect(sameRecording(own, theirs({ durationMs: 164_500 }))).toBe(false);
    expect(sameTrack(own, theirs({ durationMs: 164_500 }))).toBe(false);
  });

  it("une clé d'extension à la place du MBID ne dit pas « autre morceau » (doublon de playlist)", () => {
    const keyed = theirs({ mbids: { recording: "0c7a0e00-0000-5000-8000-000000000001", release: null, releaseGroup: null, artists: [] } });
    const ownRec = { ...own, mbids: { ...own.mbids, recording: "15befd0f-2c0c-49f5-b863-d254bbddbe90" } };
    expect(sameRecording(ownRec, keyed)).toBe(true);
    // La recherche aussi, dans un RECUEIL (« Various Artists ») : titre + album + durée suffisent, un MBID différent
    // ne contredit plus (26/10, « Sucker for Pain »). Hors recueil, un vrai MBID tranche toujours (musicLibraryMatch).
    expect(sameTrack(ownRec, keyed)).toBe(true);
  });
});
