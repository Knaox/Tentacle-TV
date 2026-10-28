import { describe, expect, it } from "vitest";
import { octaveAppLink, octaveOpenTarget, octaveOpenUrl } from "./octaveOpenLink";
import { readSharedText, SHARED_TEXT_READERS, type SharedTextReader } from "./sharedLinkReaders";

describe("ouvrir un lien d'Octave", () => {
  it.each([
    ["tentacle://octave/playlist/abc123", "/octave/playlist/abc123"],
    ["https://music.exemple.fr/octave/open/playlist/abc123", "/octave/playlist/abc123"],
    ["https://exemple.fr/tentacle/octave/open/album/ext%3Asillon%3A1", "/octave/album/ext%3Asillon%3A1"],
    ["/octave/artist/42", "/octave/artist/42"],
    ["tentacle://octave/search?q=Blinding%20Lights", "/octave/search?q=Blinding%20Lights"],
  ])("%s → %s", (input, path) => expect(octaveOpenTarget(input)).toBe(path));

  it.each([
    "tentacle://octave/settings",
    "tentacle://octave/import?shared=x",
    "tentacle://app/octave/playlist/1",
    "https://exemple.fr/octave/playlist/1",
    "https://exemple.fr/octave/open/account",
    "tentacle://octave/search",
    "javascript:alert(1)",
    "https://u:p@exemple.fr/octave/open/playlist/1",
  ])("%s n'ouvre rien", (input) => expect(octaveOpenTarget(input)).toBeNull());

  it("les deux liens d'une page", () => {
    expect(octaveOpenUrl("https://exemple.fr/", "/octave/playlist/abc")).toBe("https://exemple.fr/octave/open/playlist/abc");
    expect(octaveAppLink("/octave/playlist/abc")).toBe("tentacle://octave/playlist/abc");
    expect(octaveOpenUrl("https://exemple.fr", "/octave/settings")).toBeNull();
  });
});

describe("registre des lecteurs du texte partagé", () => {
  it("une playlist partagée d'un serveur Tentacle s'ouvre", () => {
    expect(readSharedText("Écoute ma playlist https://exemple.fr/octave/open/playlist/abc")).toEqual({ kind: "open", path: "/octave/playlist/abc" });
  });

  it("un lien Deezer s'importe", () => {
    expect(readSharedText("Écoute ça sur Deezer https://www.deezer.com/fr/playlist/908622995")).toMatchObject({ kind: "importPlaylist" });
  });

  it("un lien Shazam se cherche, avec ce que dit le message", () => {
    expect(readSharedText("I used Shazam to discover Blinding Lights by The Weeknd. https://www.shazam.com/track/20066955/blinding-lights")).toEqual({
      kind: "searchTrack",
      link: "https://www.shazam.com/track/20066955/blinding-lights",
      local: { source: "shazam", title: "Blinding Lights", artist: "The Weeknd", query: "Blinding Lights The Weeknd" },
    });
  });

  it("un texte sans lien reconnu : rien", () => {
    expect(readSharedText("bonjour https://exemple.fr")).toBeNull();
    expect(readSharedText(null)).toBeNull();
  });

  it("un lecteur de plus s'ajoute sans toucher aux autres, l'ordre décide", () => {
    const release: SharedTextReader = { id: "release", read: (t) => (t.includes("bandcamp.com") ? { kind: "importRelease", url: "https://a.bandcamp.com/album/x" } : null) };
    expect(readSharedText("https://a.bandcamp.com/album/x", [...SHARED_TEXT_READERS, release])).toMatchObject({ kind: "importRelease" });
    expect(SHARED_TEXT_READERS.map((r) => r.id)).toEqual(["open", "playlistImport", "shazam"]);
  });
});
