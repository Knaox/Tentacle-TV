import { describe, expect, it } from "vitest";
import type { TrailerEntry } from "../trailers";
import { catalogRemoteTrailers, catalogTrailerTarget, hasTrailer, resolveTrailerTarget, trailerButtonReserved } from "./trailerTarget";

const entry = (playback: TrailerEntry["playback"], name = "x"): TrailerEntry => ({
  scope: { kind: "season", season: 6 }, playback, name, version: "localized", type: "trailer", source: "allocine",
});
const ALLOCINE = entry({ kind: "dailymotion", videoId: "x8abcde" }, "Rick et Morty - saison 6 Bande-annonce VF");
const YOUTUBE = entry({ kind: "youtube", ytId: "aaaaaaaaaaa" }, "Season 6 Trailer");
const LOCAL = entry({ kind: "jellyfin", itemId: "0123456789abcdef0123456789abcdef" });

describe("bande-annonce › la cible d'après le catalogue", () => {
  it("le lecteur complet (web, bureau) : la première entrée, Dailymotion compris, par le relais", () => {
    expect(catalogTrailerTarget([ALLOCINE, YOUTUBE], ["local", "youtube", "dailymotion"])).toEqual({ kind: "relay", entry: ALLOCINE });
    expect(catalogTrailerTarget([YOUTUBE], ["local", "youtube", "dailymotion"])).toEqual({ kind: "relay", entry: YOUTUBE });
  });

  it("sans lecteur complet (TV, mobile d'ici leur phase) : Dailymotion sauté, YouTube en vidéo distante", () => {
    expect(catalogTrailerTarget([ALLOCINE, YOUTUBE], ["local", "youtube"])).toEqual({
      kind: "remote", trailer: { Url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", Name: "Season 6 Trailer", type: "Trailer" },
    });
    expect(catalogTrailerTarget([ALLOCINE], ["local", "youtube"])).toBeNull();
  });

  it("une bande-annonce locale du catalogue se lit dans le lecteur de l'app", () => {
    expect(catalogTrailerTarget([LOCAL, ALLOCINE], ["local", "youtube", "dailymotion"])).toEqual({ kind: "local", itemId: LOCAL.playback.kind === "jellyfin" ? LOCAL.playback.itemId : "" });
    expect(catalogTrailerTarget([LOCAL, YOUTUBE], ["youtube"])).toMatchObject({ kind: "remote" });
  });

  it("rien que la plateforme sache lire : aucun bouton", () => {
    expect(catalogTrailerTarget([], ["local", "youtube", "dailymotion"])).toBeNull();
    expect(hasTrailer(null, { LocalTrailerCount: 0 })).toBe(false);
  });

  it("les vidéos YouTube du catalogue, dans son ordre", () => {
    expect(catalogRemoteTrailers([ALLOCINE, YOUTUBE, LOCAL]).map((t) => t.Url)).toEqual(["https://www.youtube.com/watch?v=aaaaaaaaaaa"]);
  });

  it("sans catalogue, la règle d'avant : la locale, sinon la première distante", () => {
    expect(resolveTrailerTarget([{ Id: "local" }], [{ Url: "https://youtu.be/aaaaaaaaaaa" }])).toEqual({ kind: "local", itemId: "local" });
  });
});

describe("le bouton posé d'avance", () => {
  it("la fiche annonce une bande-annonce distante, les listes pas encore là : le bouton est posé", () => {
    expect(trailerButtonReserved({ RemoteTrailers: [{ Url: "https://youtu.be/aaaaaaaaaaa" }] }, false)).toBe(true);
  });

  it("listes reçues, ou rien d'annoncé : la règle ordinaire décide (`hasTrailer`)", () => {
    expect(trailerButtonReserved({ RemoteTrailers: [{ Url: "https://youtu.be/aaaaaaaaaaa" }] }, true)).toBe(false);
    expect(trailerButtonReserved({ RemoteTrailers: [] }, false)).toBe(false);
    expect(trailerButtonReserved({ RemoteTrailers: [{ Url: "" }] }, false)).toBe(false);
    expect(trailerButtonReserved(undefined, false)).toBe(false);
  });
});
