import { describe, expect, it } from "vitest";
import { sidBeforeOpen } from "./useMpvSource";

/**
 * Le `sid` posé AVANT le `loadfile` est ce qui évite d'avoir à changer de piste
 * après la première image — geste qui fait jeter à mpv tout son cache
 * (mpv#8422), donc barre de chargement à zéro et rechargement visible.
 */

const SIDECAR = 1000; // SIDECAR_INDEX_BASE

describe("sidAvantOuverture", () => {
  const tracks = [
    { index: 3 },                    // interne fre → sid 1
    { index: 4, external: true },    // externe serveur → sub-add
    { index: 5 },                    // interne eng → sid 2
  ];

  it("rend 0 quand aucun sous-titre n'est demandé", () => {
    expect(sidBeforeOpen(tracks, null, true)).toBe(0);
  });

  it("rend le rang parmi les INTERNES, l'externe ne décalant rien", () => {
    expect(sidBeforeOpen(tracks, 3, true)).toBe(1);
    expect(sidBeforeOpen(tracks, 5, true)).toBe(2);
  });

  it("rend 0 pour une piste externe : elle passe par sub-add", () => {
    expect(sidBeforeOpen(tracks, 4, true)).toBe(0);
  });

  it("rend 0 pour un side-car local", () => {
    expect(sidBeforeOpen(tracks, SIDECAR + 3, true)).toBe(0);
  });

  it("rend 0 en transcode, quelle que soit la piste demandée", () => {
    // Les renditions VTT du manifeste ne sont pas rendues par mpv, et le
    // burn-in est déjà dans l'image : poser `no` empêche une autosélection.
    expect(sidBeforeOpen(tracks, 3, false)).toBe(0);
  });

  it("rend 0 quand la piste demandée est introuvable", () => {
    expect(sidBeforeOpen(tracks, 99, true)).toBe(0);
  });

  it("traite un bitmap interne comme une piste ordinaire", () => {
    // mpv rend les PGS nativement : rien ne justifie de l'exclure du rang.
    const withPgs = [{ index: 3 }, { index: 4 }];
    expect(sidBeforeOpen(withPgs, 4, true)).toBe(2);
  });
});
