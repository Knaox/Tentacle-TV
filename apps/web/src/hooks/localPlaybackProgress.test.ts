/**
 * Le seuil du « vu » décide aussi de la SUPPRESSION d'un téléchargement réglé
 * sur « effacer après visionnage ». Une erreur ici efface le film de quelqu'un.
 */

import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { etatLectureLocale, seuilVu, SEUIL_VU_PAR_DEFAUT } from "./localPlaybackProgress";

describe("seuilVu", () => {
  it("retient la valeur du serveur", () => {
    expect(seuilVu(85)).toBe(85);
    expect(seuilVu(100)).toBe(100);
  });

  it("se replie sur le defaut quand la valeur manque", () => {
    expect(seuilVu(undefined)).toBe(SEUIL_VU_PAR_DEFAUT);
  });

  // Un cache localStorage bricole, ou ecrit par une version anterieure.
  it("se replie sur le defaut quand la valeur est hors bornes", () => {
    expect(seuilVu(0)).toBe(SEUIL_VU_PAR_DEFAUT);
    expect(seuilVu(-10)).toBe(SEUIL_VU_PAR_DEFAUT);
    expect(seuilVu(140)).toBe(SEUIL_VU_PAR_DEFAUT);
    expect(seuilVu(Number.NaN)).toBe(SEUIL_VU_PAR_DEFAUT);
  });
});

describe("etatLectureLocale", () => {
  it("rend la position en ticks", () => {
    expect(etatLectureLocale(12, 100, 90).ticks).toBe(12 * TICKS_PER_SECOND);
  });

  it("n'est pas vu avant le seuil", () => {
    expect(etatLectureLocale(89, 100, 90).played).toBe(false);
  });

  it("est vu au seuil exact", () => {
    expect(etatLectureLocale(90, 100, 90).played).toBe(true);
  });

  // Le seuil vient du serveur : un Jellyfin regle a 85 doit marquer vu a 85,
  // sur le bureau comme sur le web.
  it("suit le seuil du serveur", () => {
    expect(etatLectureLocale(86, 100, 85).played).toBe(true);
    expect(etatLectureLocale(86, 100, 95).played).toBe(false);
  });

  it("ne conclut rien sans duree connue", () => {
    expect(etatLectureLocale(500, 0, 90)).toEqual({ ticks: 500 * TICKS_PER_SECOND, played: false });
  });

  it("ne rend jamais une position negative", () => {
    expect(etatLectureLocale(-3, 100, 90).ticks).toBe(0);
  });

  it("borne un seuil aberrant plutot que de tout marquer vu", () => {
    expect(etatLectureLocale(1, 100, 0).played).toBe(false);
  });
});
