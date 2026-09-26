import { describe, expect, it } from "vitest";
import { STALL_MIN_PLAYED_S, videoStalled } from "./videoStall";

const live = { playedS: 2, decodedFrames: 0, paused: false, seeking: false, readyState: 4, visible: true, hasVideo: true, framesCounted: true };

describe("videoStalled — l'image figée que rien n'annonce", () => {
  it("deux secondes lues sans une image décodée : gel", () => {
    expect(videoStalled(live)).toBe(true);
  });
  it("des images décodées : pas de gel", () => {
    expect(videoStalled({ ...live, decodedFrames: 12 })).toBe(false);
  });
  it("compteur d'images jamais alimenté (plan vidéo matériel de webOS) : on ne juge pas", () => {
    // Sans cela, la veille « relançait » toutes les 4 s une lecture saine, et
    // chaque recherche ramenait l'image au début du segment.
    expect(videoStalled({ ...live, framesCounted: false })).toBe(false);
  });
  it("trop peu de lecture pour conclure", () => {
    expect(videoStalled({ ...live, playedS: STALL_MIN_PLAYED_S - 0.1 })).toBe(false);
  });
  it("en pause, en recherche, onglet masqué, sans vidéo, ou sans données : on ne juge pas", () => {
    expect(videoStalled({ ...live, paused: true })).toBe(false);
    expect(videoStalled({ ...live, seeking: true })).toBe(false);
    expect(videoStalled({ ...live, visible: false })).toBe(false);
    expect(videoStalled({ ...live, hasVideo: false })).toBe(false);
    expect(videoStalled({ ...live, readyState: 2 })).toBe(false);
  });
});
