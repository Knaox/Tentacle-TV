import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { detailGeometry, playCta } from "./detailMetrics";
import { progressBetween, topBarProgress } from "./useDetailScroll";

const t = (key: string, opts?: Record<string, unknown>) => (opts?.time ? `${key}(${opts.time})` : key);
const TICKS_PER_SEC = 10_000_000;

describe("géométrie de la fiche", () => {
  it("iPhone : scène à 70 % de la hauteur, plafonnée à 680 ; logo à 76 % de la largeur", () => {
    const g = detailGeometry(390, 844, false, false);
    expect(g.backdropH).toBe(591);
    expect(g.logoMaxW).toBe(296);
    expect(g.logoMaxH).toBe(96);
    expect(g.revealAt).toBe(Math.round(591 * 0.82));
    expect(g.twoCol).toBe(false);
    expect(detailGeometry(430, 1100, false, false).backdropH).toBe(680);
  });
  it("iPad portrait : 64 %, plafond 860, logo plafonné à 460", () => {
    const g = detailGeometry(820, 1180, true, false);
    expect(g.backdropH).toBe(755);
    expect(g.logoMaxW).toBe(460);
    expect(detailGeometry(1024, 1366, true, false).backdropH).toBe(860);
  });
  it("deux colonnes seulement sur tablette en paysage ; affiche plafonnée à 200", () => {
    const g = detailGeometry(1180, 820, true, true);
    expect(g.twoCol).toBe(true);
    expect(g.posterW).toBe(200);
    expect(g.posterH).toBe(300);
    expect(detailGeometry(844, 390, false, true).twoCol).toBe(false);
  });
});

describe("bouton Lecture", () => {
  const MIN = 60 * TICKS_PER_SEC;
  it("série terminée ou collection : pas de bouton", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    expect(playCta(series, { type: "completed" }, t).targetId).toBeNull();
    expect(playCta(series, undefined, t).targetId).toBeNull();
    expect(playCta({ Id: "b", Type: "BoxSet" } as MediaItem, undefined, t).targetId).toBeNull();
  });
  it("série : l'épisode visé, son code, sa reprise", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    const next = { Id: "e", Type: "Episode", ParentIndexNumber: 1, IndexNumber: 4 } as MediaItem;
    expect(playCta(series, { type: "next", episode: next }, t)).toEqual({ targetId: "e", label: "play · S01E04", progress: null, remainingMinutes: null });
    const started = { ...next, RunTimeTicks: 40 * MIN, UserData: { PlaybackPositionTicks: 10 * MIN } } as MediaItem;
    expect(playCta(series, { type: "continue", episode: started }, t)).toEqual({ targetId: "e", label: "resume · S01E04", progress: 0.25, remainingMinutes: 30 });
  });
  it("film entamé : avancement et temps restant", () => {
    const movie = { Id: "m", Type: "Movie", RunTimeTicks: 120 * MIN, UserData: { PlaybackPositionTicks: 30 * MIN } } as MediaItem;
    expect(playCta(movie, undefined, t)).toEqual({ targetId: "m", label: "resume", progress: 0.25, remainingMinutes: 90 });
    expect(playCta({ Id: "m", Type: "Movie" } as MediaItem, undefined, t).label).toBe("play");
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
