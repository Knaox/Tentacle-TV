/**
 * Ce qui se vérifie ici ne se voit jamais à l'écran tant que ça fonctionne :
 * un blocage empilé, ou un blocage jamais rendu, ne se manifeste qu'une heure
 * plus tard, sur la machine de quelqu'un d'autre.
 */

import { describe, expect, it } from "vitest";
import {
  creerVeilleEcran,
  creerVeilleSysteme,
  type BloqueurVeille,
  type TypeBlocage,
} from "./powerSave";

interface Factice extends BloqueurVeille {
  actifs: () => number[];
  demarrages: () => number;
  types: () => TypeBlocage[];
}

/** `powerSaveBlocker` de bureau, en mémoire. */
function bloqueurFactice(): Factice {
  const actifs = new Set<number>();
  const types: TypeBlocage[] = [];
  let suivant = 1;
  let demarrages = 0;
  return {
    start(type) {
      demarrages += 1;
      types.push(type);
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
    types: () => [...types],
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
    expect(bloqueur.types()).toEqual(["prevent-display-sleep"]);
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

describe("veille du systeme", () => {
  // C'est CE type qui repousse la mise en veille du PC sans allumer l'ecran.
  // Se tromper de type et le telechargement s'arreterait quand meme, ou bien
  // l'ecran resterait allume toute la nuit pour un transfert.
  it("demande l'anti-suspension, pas l'anti-veille de l'ecran", () => {
    const bloqueur = bloqueurFactice();

    creerVeilleSysteme(bloqueur).empecher();

    expect(bloqueur.types()).toEqual(["prevent-app-suspension"]);
  });

  it("pose un blocage, et un seul", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleSysteme(bloqueur);

    veille.empecher();
    veille.empecher();

    expect(bloqueur.demarrages()).toBe(1);
  });

  it("rend le blocage", () => {
    const bloqueur = bloqueurFactice();
    const veille = creerVeilleSysteme(bloqueur);

    veille.empecher();
    veille.rendre();

    expect(bloqueur.actifs()).toHaveLength(0);
  });
});

// Les deux blocages partagent le meme `powerSaveBlocker` : un etat commun
// ferait rendre l'anti-veille de l'ecran par la fin d'un telechargement, en
// pleine lecture.
describe("les deux blocages cohabitent", () => {
  it("rendre l'un laisse l'autre pose", () => {
    const bloqueur = bloqueurFactice();
    const ecran = creerVeilleEcran(bloqueur);
    const systeme = creerVeilleSysteme(bloqueur);

    ecran.empecher();
    systeme.empecher();
    systeme.rendre();

    expect(bloqueur.actifs()).toHaveLength(1);

    ecran.rendre();

    expect(bloqueur.actifs()).toHaveLength(0);
  });
});
