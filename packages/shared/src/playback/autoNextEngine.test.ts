import { describe, expect, it } from "vitest";
import {
  AUTO_NEXT_REPOS,
  NEXT_COUNTDOWN_MS,
  compteAfficheEnchainement,
  decideAutoNext,
  type AutoNextConfig,
  type AutoNextEntree,
  type AutoNextState,
} from "./autoNextEngine";

const CONFIG: AutoNextConfig = {
  hasNextEpisode: true,
  serverEnabled: true,
  nextCountdown: true,
  nextAutoPlay: true,
};

const tic = (eligible = true, termine = false, ecouleMs = 1_000): AutoNextEntree => ({
  type: "cadre",
  eligible,
  termine,
  ecouleMs,
});

function derouler(
  entrees: AutoNextEntree[],
  config: AutoNextConfig = CONFIG,
  depart: AutoNextState = { ...AUTO_NEXT_REPOS, pourItemId: "ep-1" },
) {
  let etat = depart;
  const effets: number[] = [];
  entrees.forEach((entree, i) => {
    const [suivant, effet] = decideAutoNext(etat, entree, config);
    etat = suivant;
    if (effet === "epsSuivant") effets.push(i);
  });
  return { etat, effets };
}

const TICS_PLEIN_DECOMPTE = Array.from({ length: NEXT_COUNTDOWN_MS / 1000 }, () => tic());

describe("les combinaisons des réglages — chacun ne fait que sa part", () => {
  it("minuteur + enchaînement : l'épisode suivant part à zéro, une seule fois", () => {
    const { etat, effets } = derouler([...TICS_PLEIN_DECOMPTE, tic(), tic()]);
    expect(effets).toEqual([NEXT_COUNTDOWN_MS / 1000 - 1]);
    expect(etat.enchaine).toBe(true);
  });

  it("minuteur sans enchaînement : le décompte va au bout et rien ne part", () => {
    const config = { ...CONFIG, nextAutoPlay: false };
    const { etat, effets } = derouler([...TICS_PLEIN_DECOMPTE, tic()], config);
    expect(effets).toEqual([]);
    expect(etat.phase).toBe("carte");
    expect(compteAfficheEnchainement(etat)).toBeNull();
  });

  it("enchaînement sans minuteur : sans échéance, rien ne part jamais tout seul", () => {
    const config = { ...CONFIG, nextCountdown: false };
    const { etat, effets } = derouler(Array.from({ length: 30 }, () => tic()), config);
    expect(effets).toEqual([]);
    expect(etat).toMatchObject({ phase: "carte", resteMs: null });
  });

  it("ni minuteur ni enchaînement : une proposition, rien d'autre", () => {
    const config = { ...CONFIG, nextCountdown: false, nextAutoPlay: false };
    const { etat, effets } = derouler([tic(), tic(), tic()], config);
    expect(effets).toEqual([]);
    expect(compteAfficheEnchainement(etat)).toBeNull();
  });
});

describe("cycle de vie", () => {
  it("le minuteur s'affiche en secondes et descend", () => {
    const { etat } = derouler([tic(), tic(), tic()]);
    expect(compteAfficheEnchainement(etat)).toBe(NEXT_COUNTDOWN_MS / 1000 - 3);
  });

  it("sortir de la fenêtre remet le minuteur à zéro, y revenir le réarme entier", () => {
    const { etat } = derouler([tic(), tic(), tic(), tic(false), tic()]);
    expect(etat.resteMs).toBe(NEXT_COUNTDOWN_MS - 1_000);
  });

  it("le refus vaut pour l'épisode : minuteur coupé, réarmé au changement d'item", () => {
    const refuse = derouler([tic(), { type: "refus" }, tic(), tic()]);
    expect(refuse.effets).toEqual([]);
    expect(refuse.etat).toMatchObject({ phase: "repos", refuse: true, resteMs: null });

    const suite = derouler([{ type: "item", itemId: "ep-2" }, tic()], CONFIG, refuse.etat);
    expect(suite.etat).toMatchObject({ refuse: false, pourItemId: "ep-2", phase: "carte" });
  });

  it("revoir le même item ne réarme pas un refus", () => {
    const { etat } = derouler([
      { type: "refus" },
      { type: "item", itemId: "ep-1" },
      tic(),
    ]);
    expect(etat.refuse).toBe(true);
    expect(etat.phase).toBe("repos");
  });

  it("l'escalade carte → écran de fin conserve le minuteur en cours", () => {
    const { etat } = derouler([tic(), tic(), tic(), tic(true, true)]);
    expect(etat.phase).toBe("final");
    expect(etat.resteMs).toBe(NEXT_COUNTDOWN_MS - 4_000);
  });

  it("une fin de lecture directe arme son propre minuteur", () => {
    const { etat } = derouler([tic(false, true)]);
    expect(etat).toMatchObject({ phase: "final", resteMs: NEXT_COUNTDOWN_MS - 1_000 });
  });

  it("« lire maintenant » part tout de suite, et une seule fois", () => {
    const { effets } = derouler([
      tic(),
      { type: "lireMaintenant" },
      { type: "lireMaintenant" },
      ...TICS_PLEIN_DECOMPTE,
    ]);
    expect(effets).toEqual([1]);
  });

  it("la garde serveur ou l'absence d'épisode suivant éteint tout", () => {
    const sansServeur = derouler([...TICS_PLEIN_DECOMPTE], { ...CONFIG, serverEnabled: false });
    expect(sansServeur.effets).toEqual([]);
    expect(sansServeur.etat.phase).toBe("repos");

    const sansSuite = derouler(
      [tic(), { type: "lireMaintenant" }],
      { ...CONFIG, hasNextEpisode: false },
    );
    expect(sansSuite.effets).toEqual([]);
  });
});
