/**
 * La sélection décide de ce qui SERA SUPPRIMÉ. Une erreur ici n'est pas une
 * gêne d'affichage : c'est un film qui part sans qu'on l'ait demandé, ou un
 * compteur qui promet cinq suppressions et n'en fait que trois.
 */

import { describe, expect, it } from "vitest";
import { toggle, prune, state, toggleAll } from "./selection";

describe("elaguer", () => {
  it("retire ce qui a disparu de la liste", () => {
    // Cas reel : une purge differee emporte une ligne cochee sous les doigts.
    expect([...prune(new Set([1, 2, 3]), [1, 3])]).toEqual([1, 3]);
  });

  it("une liste vide vide la selection", () => {
    expect(prune(new Set([1, 2]), []).size).toBe(0);
  });

  it("ne rend jamais le meme ensemble : l'appelant compare les references", () => {
    const prev = new Set([1]);
    expect(prune(prev, [1])).not.toBe(prev);
  });
});

describe("basculer", () => {
  it("ajoute puis retire", () => {
    const un = toggle(new Set(), 7);
    expect([...un]).toEqual([7]);
    expect([...toggle(un, 7)]).toEqual([]);
  });
});

describe("etat", () => {
  it("distingue aucune, partielle et totale", () => {
    expect(state(new Set(), [1, 2])).toBe("aucune");
    expect(state(new Set([1]), [1, 2])).toBe("partielle");
    expect(state(new Set([1, 2]), [1, 2])).toBe("totale");
  });

  it("une liste VIDE n'est jamais totale", () => {
    // Sinon la case d'en-tete s'affiche cochee alors que rien ne l'est.
    expect(state(new Set(), [])).toBe("aucune");
    expect(state(new Set([9]), [])).toBe("aucune");
  });

  it("une selection qui ne recoupe plus la liste vaut aucune", () => {
    expect(state(new Set([42]), [1, 2])).toBe("aucune");
  });
});

describe("toutBasculer", () => {
  it("depuis rien, prend tout", () => {
    expect([...toggleAll(new Set(), [1, 2, 3])]).toEqual([1, 2, 3]);
  });

  it("depuis une selection PARTIELLE, complete au lieu de vider", () => {
    // Geste attendu de tout gestionnaire de fichiers.
    expect([...toggleAll(new Set([2]), [1, 2, 3])]).toEqual([1, 2, 3]);
  });

  it("depuis tout, vide", () => {
    expect([...toggleAll(new Set([1, 2]), [1, 2])]).toEqual([]);
  });

  it("oublie ce qui n'est plus la en prenant tout", () => {
    expect([...toggleAll(new Set([99]), [1])]).toEqual([1]);
  });
});
