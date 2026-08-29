/**
 * Le seuil du « vu » décide aussi de la SUPPRESSION d'un téléchargement réglé
 * sur « effacer après visionnage ». Une erreur ici efface le film de quelqu'un.
 */

import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { localPlaybackState, watchedThreshold, DEFAULT_WATCHED_THRESHOLD } from "./localPlaybackProgress";

describe("seuilVu", () => {
  it("retient la valeur du serveur", () => {
    expect(watchedThreshold(85)).toBe(85);
    expect(watchedThreshold(100)).toBe(100);
  });

  it("se replie sur le defaut quand la valeur manque", () => {
    expect(watchedThreshold(undefined)).toBe(DEFAULT_WATCHED_THRESHOLD);
  });

  // Un cache localStorage bricole, ou ecrit par une version anterieure.
  it("se replie sur le defaut quand la valeur est hors bornes", () => {
    expect(watchedThreshold(0)).toBe(DEFAULT_WATCHED_THRESHOLD);
    expect(watchedThreshold(-10)).toBe(DEFAULT_WATCHED_THRESHOLD);
    expect(watchedThreshold(140)).toBe(DEFAULT_WATCHED_THRESHOLD);
    expect(watchedThreshold(Number.NaN)).toBe(DEFAULT_WATCHED_THRESHOLD);
  });
});

describe("etatLectureLocale", () => {
  it("rend la position en ticks", () => {
    expect(localPlaybackState(12, 100, 90).ticks).toBe(12 * TICKS_PER_SECOND);
  });

  it("n'est pas vu avant le seuil", () => {
    expect(localPlaybackState(89, 100, 90).played).toBe(false);
  });

  it("est vu au seuil exact", () => {
    expect(localPlaybackState(90, 100, 90).played).toBe(true);
  });

  // Le seuil vient du serveur : un Jellyfin regle a 85 doit marquer vu a 85,
  // sur le bureau comme sur le web.
  it("suit le seuil du serveur", () => {
    expect(localPlaybackState(86, 100, 85).played).toBe(true);
    expect(localPlaybackState(86, 100, 95).played).toBe(false);
  });

  it("ne conclut rien sans duree connue", () => {
    expect(localPlaybackState(500, 0, 90)).toEqual({ ticks: 500 * TICKS_PER_SECOND, played: false });
  });

  it("ne rend jamais une position negative", () => {
    expect(localPlaybackState(-3, 100, 90).ticks).toBe(0);
  });

  it("borne un seuil aberrant plutot que de tout marquer vu", () => {
    expect(localPlaybackState(1, 100, 0).played).toBe(false);
  });
});
