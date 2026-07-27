/**
 * Ce qui se vérifie ici ne se voit jamais à l'écran tant que ça fonctionne :
 * un blocage empilé, ou un blocage jamais rendu, ne se manifeste qu'une heure
 * plus tard, sur la machine de quelqu'un d'autre.
 */

import { describe, expect, it } from "vitest";
import { creerVeilleEcran, type BloqueurVeille } from "./displaySleep";

/** `powerSaveBlocker` de bureau, en mémoire. */
function bloqueurFactice(): BloqueurVeille & { actifs: () => number[]; demarrages: () => number } {
  const actifs = new Set<number>();
  let suivant = 1;
  let demarrages = 0;
  return {
    start() {
      demarrages += 1;
      const id = suivant;
      suivant += 1;
      actifs.add(id);
      return id;
    },
    stop(id) {
      actifs.delete(id);
    },
    isStarted(id) {
      return actifs.has(id);
    },
    actifs: () => [...actifs],
    demarrages: () => demarrages,
  };
}

describe("veille de l'ecran", () => {
  it("pose un blocage, et un seul", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleEcran(bloqueur);

    veille.empecher();
    veille.empecher();
    veille.empecher();

    expect(bloqueur.demarrages()).toBe(1);
    expect(bloqueur.actifs()).toHaveLength(1);
  });

  it("rend le blocage", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleEcran(bloqueur);

    veille.empecher();
    veille.rendre();

    expect(bloqueur.actifs()).toHaveLength(0);
  });

  it("ne fait rien quand il n'y a rien a rendre", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleEcran(bloqueur);

    veille.rendre();
    veille.rendre();

    expect(bloqueur.demarrages()).toBe(0);
    expect(bloqueur.actifs()).toHaveLength(0);
  });

  it("repose un blocage apres l'avoir rendu", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleEcran(bloqueur);

    veille.empecher();
    veille.rendre();
    veille.empecher();

    expect(bloqueur.demarrages()).toBe(2);
    expect(bloqueur.actifs()).toHaveLength(1);
  });

  // Le systeme peut lever un blocage de son cote : le croire encore actif
  // laisserait l'ecran s'eteindre en pleine lecture, sans que rien ne le dise.
  it("repose un blocage que le systeme a leve", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleEcran(bloqueur);

    veille.empecher();
    const pose = bloqueur.actifs()[0];
    expect(pose).toBeDefined();
    if (pose !== undefined) bloqueur.stop(pose);
    veille.empecher();

    expect(bloqueur.demarrages()).toBe(2);
    expect(bloqueur.actifs()).toHaveLength(1);
  });
});
