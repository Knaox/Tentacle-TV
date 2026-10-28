import { describe, expect, it } from "vitest";
import { findShazamLink, localSharedTrackQuery, parseShazamPageTitle, recognizeShazamUrl, shazamShareTextQuery, shazamSlugQuery } from "./shazamLink";

describe("liens Shazam", () => {
  it.each([
    ["https://www.shazam.com/track/20066955/blinding-lights", "20066955", "blinding-lights"],
    ["https://www.shazam.com/song/6773775295/the-feeling", "6773775295", "the-feeling"],
    ["https://shazam.com/fr-fr/song/123/ma-chanson?referrer=share", "123", "ma-chanson"],
    ["https://www.shazam.com/track/42", "42", null],
  ])("%s est un titre", (url, id, slug) => {
    expect(recognizeShazamUrl(url)).toMatchObject({ kind: "track", trackId: id, slug });
  });

  it("un lien court se reconnaît, sans titre à lire", () => {
    expect(recognizeShazamUrl("https://shz.am/t20066955")).toMatchObject({ kind: "short", code: "t20066955" });
  });

  it.each(["https://evil.com/track/1/x", "https://www.shazam.com/artist/1/x", "https://user:pw@www.shazam.com/track/1/x", "ftp://www.shazam.com/track/1", "pas un lien"])(
    "%s n'est pas reconnu",
    (url) => expect(recognizeShazamUrl(url)).toBeNull(),
  );

  it("trouve le lien dans le message d'accompagnement", () => {
    const text = "I used Shazam to discover Blinding Lights by The Weeknd. https://www.shazam.com/track/20066955/blinding-lights.";
    const link = findShazamLink(text)!;
    expect(link).toMatchObject({ trackId: "20066955" });
    expect(localSharedTrackQuery(text, link)).toEqual({ source: "shazam", title: "Blinding Lights", artist: "The Weeknd", query: "Blinding Lights The Weeknd" });
  });

  it("message en français", () => {
    expect(shazamShareTextQuery("J'ai utilisé Shazam pour découvrir Alors on danse de Stromae. https://www.shazam.com/track/1/x")).toMatchObject({ title: "Alors on danse", artist: "Stromae" });
  });

  it("sans message : le slug, sans artiste", () => {
    const link = findShazamLink("https://www.shazam.com/track/1/blinding-lights")!;
    expect(shazamSlugQuery(link)).toEqual({ source: "shazam", title: "blinding lights", artist: null, query: "blinding lights" });
    expect(localSharedTrackQuery("https://www.shazam.com/track/1/blinding-lights", link)?.query).toBe("blinding lights");
  });

  it("le titre de la page : l'artiste après le dernier tiret, le suffixe coupé", () => {
    expect(parseShazamPageTitle("DtMF - Bad Bunny: Song Lyrics, Music Videos &amp; Concerts".replace("&amp;", "&"))).toMatchObject({ title: "DtMF", artist: "Bad Bunny" });
    expect(parseShazamPageTitle("Song - Remastered 2011 - The Band: Song Lyrics")).toMatchObject({ title: "Song - Remastered 2011", artist: "The Band" });
    expect(parseShazamPageTitle("Shazam")).toBeNull();
  });
});
