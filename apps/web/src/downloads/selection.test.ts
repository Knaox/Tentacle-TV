/**
 * La sélection décide de ce qui SERA SUPPRIMÉ. Une erreur ici n'est pas une
 * gêne d'affichage : c'est un film qui part sans qu'on l'ait demandé, ou un
 * compteur qui promet cinq suppressions et n'en fait que trois.
 */

import { describe, expect, it } from "vitest";
import { basculer, elaguer, etat, toutBasculer } from "./selection";

describe("elaguer", () => {
  it("retire ce qui a disparu de la liste", () => {
    // Cas reel : une purge differee emporte une ligne cochee sous les doigts.
    expect([...elaguer(new Set([1, 2, 3]), [1, 3])]).toEqual([1, 3]);
  });

  it("une liste vide vide la selection", () => {
    expect(elaguer(new Set([1, 2]), []).size).toBe(0);
  });

  it("ne rend jamais le meme ensemble : l'appelant compare les references", () => {
    const avant = new Set([1]);
    expect(elaguer(avant, [1])).not.toBe(avant);
  });
});

describe("basculer", () => {
  it("ajoute puis retire", () => {
    const un = basculer(new Set(), 7);
    expect([...un]).toEqual([7]);
    expect([...basculer(un, 7)]).toEqual([]);
  });
});

describe("etat", () => {
  it("distingue aucune, partielle et totale", () => {
    expect(etat(new Set(), [1, 2])).toBe("aucune");
    expect(etat(new Set([1]), [1, 2])).toBe("partielle");
    expect(etat(new Set([1, 2]), [1, 2])).toBe("totale");
  });

  it("une liste VIDE n'est jamais totale", () => {
    // Sinon la case d'en-tete s'affiche cochee alors que rien ne l'est.
    expect(etat(new Set(), [])).toBe("aucune");
    expect(etat(new Set([9]), [])).toBe("aucune");
  });

  it("une selection qui ne recoupe plus la liste vaut aucune", () => {
    expect(etat(new Set([42]), [1, 2])).toBe("aucune");
  });
});

describe("toutBasculer", () => {
  it("depuis rien, prend tout", () => {
    expect([...toutBasculer(new Set(), [1, 2, 3])]).toEqual([1, 2, 3]);
  });

  it("depuis une selection PARTIELLE, complete au lieu de vider", () => {
    // Geste attendu de tout gestionnaire de fichiers.
    expect([...toutBasculer(new Set([2]), [1, 2, 3])]).toEqual([1, 2, 3]);
  });

  it("depuis tout, vide", () => {
    expect([...toutBasculer(new Set([1, 2]), [1, 2])]).toEqual([]);
  });

  it("oublie ce qui n'est plus la en prenant tout", () => {
    expect([...toutBasculer(new Set([99]), [1])]).toEqual([1]);
  });
});
