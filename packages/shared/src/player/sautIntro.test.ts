import { describe, expect, it } from "vitest";
import {
  DEPART_SAUT_INTRO,
  GARDE_SAUT_MS,
  REPOS,
  compteAffiche,
  deciderSautIntro,
  montrerPilule,
  type ActionSautIntro,
  type EntreeSautIntro,
  type EtatSautIntro,
} from "./sautIntro";

/** Déroule une suite d'entrées en tenant le front de `visible` comme le hook. */
function derouler(entrees: EntreeSautIntro[], depart: EtatSautIntro = REPOS) {
  let etat = depart;
  let visiblePrecedent = false;
  const sauts: number[] = [];
  entrees.forEach((entree, i) => {
    let action: ActionSautIntro;
    [etat, action] = deciderSautIntro(etat, entree, visiblePrecedent);
    if (action === "sauter") sauts.push(i);
    if (entree.type === "cadre") visiblePrecedent = entree.visible;
  });
  return { etat, sauts };
}

const tic = (visible: boolean, actif = true): EntreeSautIntro =>
  ({ type: "cadre", visible, actif, ecouleMs: 1000 });

describe("deciderSautIntro", () => {
  it("compte trois secondes puis saute", () => {
    const { etat, sauts } = derouler([tic(true), tic(true), tic(true), tic(true)]);
    expect(sauts).toEqual([3]);
    expect(etat.nom).toBe("saute");
  });

  it("ne compte pas quand la préférence est éteinte", () => {
    const { etat, sauts } = derouler([tic(true, false), tic(true, false), tic(true, false)]);
    expect(sauts).toEqual([]);
    expect(compteAffiche(etat)).toBeNull();
    expect(montrerPilule(etat, true)).toBe(true); // le bouton manuel reste
  });

  it("la croix arrête le décompte sans masquer la pilule", () => {
    const { etat, sauts } = derouler([tic(true), { type: "croix" }, tic(true), tic(true), tic(true)]);
    expect(sauts).toEqual([]);
    expect(etat.nom).toBe("refuse");
    expect(compteAffiche(etat)).toBeNull();
    expect(montrerPilule(etat, true)).toBe(true);
  });

  // Le premier défaut signalé : annuler, laisser l'intro filer, revenir dessus.
  it("réarme quand on revient dans l'intro après avoir annulé", () => {
    const { etat, sauts } = derouler([
      tic(true), { type: "croix" }, tic(true), // refusé, on reste dans l'intro
      tic(false),                              // l'intro est passée
      tic(true),                               // retour en arrière : ça réarme
    ]);
    expect(sauts).toEqual([]);
    expect(compteAffiche(etat)).toBe(DEPART_SAUT_INTRO);
  });

  // Le second : la pilule ne doit pas réapparaître pendant que la position
  // rattrape — elle est échantillonnée à 1 Hz et un saut HLS prend des secondes.
  it("masque la pilule tant que la lecture n'a pas rejoint la cible", () => {
    const { etat } = derouler([tic(true), tic(true), tic(true), tic(true), tic(true), tic(true)]);
    expect(etat.nom).toBe("saute");
    expect(montrerPilule(etat, true)).toBe(false);
  });

  it("rend le bouton manuel si le saut n'aboutit jamais", () => {
    const apres = Array.from({ length: GARDE_SAUT_MS / 1000 + 4 }, () => tic(true));
    const { etat } = derouler(apres);
    expect(etat.nom).toBe("repos");
    expect(montrerPilule(etat, true)).toBe(true);
  });

  it("une réévaluation sans temps écoulé ne consomme pas de seconde", () => {
    const reevaluer: EntreeSautIntro = { type: "cadre", visible: true, actif: true, ecouleMs: 0 };
    const { etat } = derouler([tic(true), reevaluer, reevaluer, reevaluer]);
    expect(compteAffiche(etat)).toBe(DEPART_SAUT_INTRO);
  });

  it("un saut manuel masque la pilule comme un saut automatique", () => {
    const { etat, sauts } = derouler([tic(true), { type: "sauteMaintenant" }]);
    expect(sauts).toEqual([1]);
    expect(montrerPilule(etat, true)).toBe(false);
  });

  it("quitter l'intro remet tout à zéro", () => {
    const { etat } = derouler([tic(true), { type: "croix" }, tic(false)]);
    expect(etat).toEqual(REPOS);
    expect(montrerPilule(etat, false)).toBe(false);
  });
});
