import { describe, expect, it } from "vitest";
import { ImportReadFailure } from "./readerKit";
import { csvCells, parseDuration, readText } from "./textReader";

describe("liste collée — CSV d'un export", () => {
  it("Exportify : colonnes par leur nom, durée en ms, ISRC, guillemets", () => {
    const csv = [
      '"Track URI","Track Name","Artist Name(s)","Album Name","Duration (ms)","ISRC"',
      '"spotify:track:1","Let\'s Groove","Earth, Wind & Fire","Raise!","339000","USSM18100116"',
      '"spotify:track:2","Sweet Dreams (Are Made of This) - Remastered","Eurythmics,Annie Lennox,Dave Stewart","Sweet Dreams","216933","GBARL0500018"',
    ].join("\n");
    const pl = readText(csv);
    expect(pl.source).toBe("text");
    expect(pl.tracks).toHaveLength(2);
    expect(pl.tracks[0]).toMatchObject({ index: 0, title: "Let's Groove", artists: ["Earth, Wind & Fire"], album: "Raise!", durationMs: 339_000, isrc: "USSM18100116" });
    expect(pl.tracks[1]?.artists).toEqual(["Eurythmics,Annie Lennox,Dave Stewart"]);
  });

  it("TuneMyMusic (en-têtes en minuscules) et nom de la playlist", () => {
    const csv = "Track name,Artist name,Album,Playlist name,Type,ISRC\nOne More Time,Daft Punk,Discovery,Soirée,Playlist,GBDUW0000053\n";
    const pl = readText(csv);
    expect(pl.name).toBe("Soirée");
    expect(pl.tracks[0]).toMatchObject({ title: "One More Time", artists: ["Daft Punk"], isrc: "GBDUW0000053" });
  });

  it("point-virgule, en-têtes français, BOM, durée « m:ss »", () => {
    const csv = "﻿Titre;Artiste;Album;Durée\nLa Bohème;Charles Aznavour;La Bohème;4:08\n";
    expect(readText(csv).tracks[0]).toMatchObject({ title: "La Bohème", artists: ["Charles Aznavour"], durationMs: 248_000 });
  });
});

describe("liste collée — une ligne par titre", () => {
  it("« Artiste - Titre », numérotation et lignes vides ignorées", () => {
    const pl = readText("1. Daft Punk - One More Time\n\n2) Justice – D.A.N.C.E.\nQueen - Bohemian Rhapsody - Remastered 2011\n");
    expect(pl.tracks.map((t) => [t.artists[0], t.title])).toEqual([
      ["Daft Punk", "One More Time"],
      ["Justice", "D.A.N.C.E."],
      ["Queen", "Bohemian Rhapsody - Remastered 2011"],
    ]);
  });

  it("« Titre<TAB>Artiste » et un titre seul", () => {
    const pl = readText("Get Lucky\tDaft Punk\nUn titre sans artiste");
    expect(pl.tracks[0]).toMatchObject({ title: "Get Lucky", artists: ["Daft Punk"] });
    expect(pl.tracks[1]).toMatchObject({ title: "Un titre sans artiste", artists: [] });
  });

  it("vide : refusé en mots fermés", () => {
    expect(() => readText("  \n\n")).toThrow(ImportReadFailure);
  });

  it("plafond : 1 000 titres, la suite dite tronquée", () => {
    const pl = readText(Array.from({ length: 1_200 }, (_, i) => `A - T${i}`).join("\n"));
    expect(pl.tracks).toHaveLength(1_000);
    expect(pl.truncated).toBe(true);
  });
});

describe("outils", () => {
  it("cellules CSV : guillemets doublés, séparateur dans les guillemets", () => {
    expect(csvCells('"a ""b""","c,d",e', ",")).toEqual(['a "b"', "c,d", "e"]);
  });

  it("durées", () => {
    expect(parseDuration("3:45")).toBe(225_000);
    expect(parseDuration("1:02:03")).toBe(3_723_000);
    expect(parseDuration("215")).toBe(215_000);
    expect(parseDuration("215000")).toBe(215_000);
    expect(parseDuration("x")).toBeNull();
  });
});
