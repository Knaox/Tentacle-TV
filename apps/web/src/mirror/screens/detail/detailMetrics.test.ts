import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { buildSeriesPlayLabel, detailGeometry, formatTime, playCta, youtubeId } from "./detailMetrics";
import { progressBetween, topBarProgress } from "./useDetailScroll";

const t = (key: string, opts?: Record<string, unknown>) => (opts?.time ? `${key}(${opts.time})` : key);
const TICKS_PER_SEC = 10_000_000;

describe("géométrie de la fiche", () => {
  it("iPhone : visuel à 52 % de la hauteur, plafonné à 520 ; affiche à 32 % de la largeur", () => {
    const g = detailGeometry(390, 844, false, false);
    expect(g.backdropH).toBe(439);
    expect(g.posterW).toBe(125);
    expect(g.posterH).toBe(188);
    expect(g.revealAt).toBeCloseTo(439 * 0.62);
    expect(g.twoCol).toBe(false);
  });
  it("iPad portrait : plafond 620, affiche plafonnée à 200", () => {
    const g = detailGeometry(820, 1180, true, false);
    expect(g.backdropH).toBe(614);
    expect(g.posterW).toBe(200);
    expect(g.posterH).toBe(300);
    expect(detailGeometry(1024, 1366, true, false).backdropH).toBe(620);
  });
  it("deux colonnes seulement sur tablette en paysage", () => {
    expect(detailGeometry(1180, 820, true, true).twoCol).toBe(true);
    expect(detailGeometry(844, 390, false, true).twoCol).toBe(false);
  });
});

describe("libellé du bouton Lecture", () => {
  it("formate comme l'app", () => {
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(3725)).toBe("1:02:05");
  });
  it("série : épisode à reprendre, code S/E", () => {
    const ep = { ParentIndexNumber: 2, IndexNumber: 3, UserData: { PlaybackPositionTicks: 90 * TICKS_PER_SEC } };
    expect(buildSeriesPlayLabel(ep, t)).toBe("resumeAt(01:30) · S02E03");
    expect(buildSeriesPlayLabel({ IndexNumber: 1 }, t)).toBe("play · S01E01");
  });
  it("série terminée : pas de bouton", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    expect(playCta(series, { type: "completed" }, t).targetId).toBeNull();
    expect(playCta(series, undefined, t).targetId).toBeNull();
  });
  it("série en cours : lance l'épisode suivant, sans barre", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    const episode = { Id: "e", Type: "Episode", ParentIndexNumber: 1, IndexNumber: 4 } as MediaItem;
    const cta = playCta(series, { type: "next", episode }, t);
    expect(cta).toMatchObject({ targetId: "e", label: "play · S01E04", showProgress: false });
  });
  it("film entamé : reprise et progression", () => {
    const movie = {
      Id: "m",
      Type: "Movie",
      UserData: { PlaybackPositionTicks: 600 * TICKS_PER_SEC, PlayedPercentage: 25 },
    } as MediaItem;
    expect(playCta(movie, undefined, t)).toEqual({ targetId: "m", label: "resumeAt(10:00)", showProgress: true, progress: 0.25 });
  });
});

describe("fondus de la barre haute", () => {
  it("se solidifie sur les 80 derniers points, titre sur les 40 derniers", () => {
    expect(topBarProgress(0, 300)).toEqual({ bar: 0, title: 0 });
    expect(topBarProgress(260, 300)).toEqual({ bar: 0.5, title: 0 });
    expect(topBarProgress(280, 300).title).toBeCloseTo(0.5);
    expect(topBarProgress(500, 300)).toEqual({ bar: 1, title: 1 });
  });
  it("borne basse à zéro quand le seuil est court", () => {
    expect(progressBetween(-10, 0, 50)).toBe(0);
    expect(topBarProgress(25, 50).bar).toBeCloseTo(0.5);
  });
});

describe("bandes-annonces", () => {
  it("reconnaît les trois formes d'URL YouTube", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/1234")).toBeNull();
  });
});
