/**
 * L'invariant tenu ici : en lecture locale, AUCUNE URL distante ne subsiste sur
 * une piste de sous-titres. Il ne se voit qu'au panneau réseau du diagnostic, ou
 * au bout du network-timeout quand le réseau est coupé — jamais à l'écran.
 */

import { describe, expect, it } from "vitest";
import { mapSubtitlesToLocal } from "./useDesktopSource";
import type { LocalSource } from "../downloads/playbackApi";
import type { SubtitleTrack } from "../components/VideoPlayer";

const URL_SERVEUR = "https://jf.example/Videos/i1/ms1/Subtitles/3/Stream.vtt";

function source(fichiers: Array<{ fileName: string; absolutePath: string }>): LocalSource {
  return {
    fileId: 1,
    variant: "original",
    absolutePath: "C:/dl/media/i1/original-ms1.mkv",
    subtitleFiles: fichiers,
    positionTicks: 0,
    played: false,
    autoDeleteAfterWatch: false,
    autoDeleteDelayMinutes: 0,
    deleteScheduledAt: null,
    title: null,
    seriesName: null,
    runtimeTicks: null,
    indexNumber: null,
    parentIndexNumber: null,
    libraryId: null,
  };
}

function piste(index: number, url: string): SubtitleTrack {
  return { index, label: `piste ${index}`, url };
}

describe("mapSubtitlesToLocal", () => {
  it("laisse les pistes intactes en streaming", () => {
    const tracks = [piste(3, URL_SERVEUR)];
    expect(mapSubtitlesToLocal(tracks, null)).toBe(tracks);
  });

  it("remplace l'URL par le side-car de meme index", () => {
    const tracks = mapSubtitlesToLocal(
      [piste(3, URL_SERVEUR)],
      source([{ fileName: "3-fre-forced.srt", absolutePath: "C:/dl/media/i1/subs/3-fre-forced.srt" }]),
    );
    expect(tracks[0]?.url).toBe("C:/dl/media/i1/subs/3-fre-forced.srt");
  });

  // Le cas le plus courant : un fichier dont toutes les pistes sont internes.
  // La liste des side-cars est vide, et rien ne doit partir vers le serveur.
  it("vide l'URL d'une piste sans side-car", () => {
    const tracks = mapSubtitlesToLocal([piste(3, URL_SERVEUR)], source([]));
    expect(tracks[0]?.url).toBe("");
    expect(tracks[0]?.label).toBe("piste 3");
  });

  it("vide l'URL quand seul un AUTRE index a son side-car", () => {
    const tracks = mapSubtitlesToLocal(
      [piste(2, URL_SERVEUR), piste(3, URL_SERVEUR)],
      source([{ fileName: "3-eng.srt", absolutePath: "C:/dl/media/i1/subs/3-eng.srt" }]),
    );
    expect(tracks[0]?.url).toBe("");
    expect(tracks[1]?.url).toBe("C:/dl/media/i1/subs/3-eng.srt");
  });

  // `startsWith("1-")` ne confondait pas « 10- », mais l'index analyse dit
  // exactement ce que le nom de fichier designe, langue et variantes comprises.
  it("n'apparie pas un side-car dont l'index differe", () => {
    const tracks = mapSubtitlesToLocal(
      [piste(1, URL_SERVEUR)],
      source([{ fileName: "10-fre.srt", absolutePath: "C:/dl/media/i1/subs/10-fre.srt" }]),
    );
    expect(tracks[0]?.url).toBe("");
  });

  it("ignore un fichier au nom illisible", () => {
    const tracks = mapSubtitlesToLocal(
      [piste(3, URL_SERVEUR)],
      source([{ fileName: "notes.txt", absolutePath: "C:/dl/media/i1/subs/notes.txt" }]),
    );
    expect(tracks[0]?.url).toBe("");
  });

  // Une piste construite par buildLocalSubtitleTracks porte deja une URL vide :
  // mpv la lit par `sid`, il n'y a rien a rapprocher.
  it("laisse une piste sans URL telle quelle", () => {
    const interne = piste(1, "");
    const tracks = mapSubtitlesToLocal(
      [interne],
      source([{ fileName: "1-fre.srt", absolutePath: "C:/dl/media/i1/subs/1-fre.srt" }]),
    );
    expect(tracks[0]).toBe(interne);
  });
});
