import { describe, expect, it } from "vitest";
import { sharedTrackSearchState } from "./useSharedTrackSearch";

const q = (query: string) => ({ source: "shazam" as const, title: query, artist: null, query });

describe("un lien Shazam dans la recherche", () => {
  it("pas un lien : la recherche suit son cours", () => {
    expect(sharedTrackSearchState({ isLink: false, local: null, capable: true, server: { status: "pending" } })).toEqual({ isLink: false, resolved: null, pending: false, failed: false });
  });

  it("le serveur sait : on l'attend, puis son titre l'emporte sur le slug", () => {
    expect(sharedTrackSearchState({ isLink: true, local: q("slug"), capable: true, server: { status: "pending" } })).toMatchObject({ pending: true, resolved: null });
    expect(sharedTrackSearchState({ isLink: true, local: q("slug"), capable: true, server: { status: "success", data: q("Vrai Titre Artiste") } }).resolved?.query).toBe("Vrai Titre Artiste");
  });

  it("le serveur échoue : ce que le texte dit", () => {
    expect(sharedTrackSearchState({ isLink: true, local: q("blinding lights"), capable: true, server: { status: "error" } })).toMatchObject({ pending: false, failed: false, resolved: { query: "blinding lights" } });
  });

  it("un serveur d'avant (sans la capacité) : aucune attente, le texte seul", () => {
    expect(sharedTrackSearchState({ isLink: true, local: q("x"), capable: false, server: { status: "pending" } })).toMatchObject({ pending: false, resolved: { query: "x" } });
    expect(sharedTrackSearchState({ isLink: true, local: null, capable: false, server: { status: "pending" } })).toMatchObject({ pending: false, failed: true, resolved: null });
  });
});
