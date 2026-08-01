import { describe, expect, it } from "vitest";
import { sidAvantOuverture } from "./useMpvSource";

/**
 * Le `sid` posé AVANT le `loadfile` est ce qui évite d'avoir à changer de piste
 * après la première image — geste qui fait jeter à mpv tout son cache
 * (mpv#8422), donc barre de chargement à zéro et rechargement visible.
 */

const SIDECAR = 1000; // SIDECAR_INDEX_BASE

describe("sidAvantOuverture", () => {
  const pistes = [
    { index: 3 },                    // interne fre → sid 1
    { index: 4, external: true },    // externe serveur → sub-add
    { index: 5 },                    // interne eng → sid 2
  ];

  it("rend 0 quand aucun sous-titre n'est demandé", () => {
    expect(sidAvantOuverture(pistes, null, true)).toBe(0);
  });

  it("rend le rang parmi les INTERNES, l'externe ne décalant rien", () => {
    expect(sidAvantOuverture(pistes, 3, true)).toBe(1);
    expect(sidAvantOuverture(pistes, 5, true)).toBe(2);
  });

  it("rend 0 pour une piste externe : elle passe par sub-add", () => {
    expect(sidAvantOuverture(pistes, 4, true)).toBe(0);
  });

  it("rend 0 pour un side-car local", () => {
    expect(sidAvantOuverture(pistes, SIDECAR + 3, true)).toBe(0);
  });

  it("rend 0 en transcode, quelle que soit la piste demandée", () => {
    // Les renditions VTT du manifeste ne sont pas rendues par mpv, et le
    // burn-in est déjà dans l'image : poser `no` empêche une autosélection.
    expect(sidAvantOuverture(pistes, 3, false)).toBe(0);
  });

  it("rend 0 quand la piste demandée est introuvable", () => {
    expect(sidAvantOuverture(pistes, 99, true)).toBe(0);
  });

  it("traite un bitmap interne comme une piste ordinaire", () => {
    // mpv rend les PGS nativement : rien ne justifie de l'exclure du rang.
    const avecPgs = [{ index: 3 }, { index: 4 }];
    expect(sidAvantOuverture(avecPgs, 4, true)).toBe(2);
  });
});
