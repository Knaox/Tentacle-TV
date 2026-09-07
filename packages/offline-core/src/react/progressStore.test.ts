/**
 * Le débit et le temps restant, dérivés d'échantillons irréguliers.
 *
 * Ce qui compte ici : un RECUL n'invente pas un débit négatif. Une reprise qui
 * repart de zéro, ou une taille recalée sur le disque, ferait autrement
 * afficher un temps restant absurde.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { clearProgress, getProgressFor, updateProgress } from "./progressStore";

const FILE = 1;

beforeEach(() => {
  clearProgress();
});

describe("debit", () => {
  it("le premier echantillon ne mesure rien : il n'y a pas d'ecart", () => {
    updateProgress(FILE, { bytesDone: 1_000, expectedSize: 10_000 }, 0);
    expect(getProgressFor(FILE)?.rateBps).toBeNull();
    expect(getProgressFor(FILE)?.etaMs).toBeNull();
  });

  it("deux echantillons donnent un debit et un temps restant", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: 10_000 }, 0);
    updateProgress(FILE, { bytesDone: 1_000, expectedSize: 10_000 }, 1_000);

    const snapshot = getProgressFor(FILE);
    expect(snapshot?.rateBps).toBe(1_000);
    // 9 000 octets restants a 1 000 o/s.
    expect(snapshot?.etaMs).toBe(9_000);
  });

  it("un echantillon trop rapproche ne remplace pas la mesure", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: 10_000 }, 0);
    updateProgress(FILE, { bytesDone: 1_000, expectedSize: 10_000 }, 1_000);
    // 100 ms plus tard : sous le seuil, le debit precedent tient.
    updateProgress(FILE, { bytesDone: 1_100, expectedSize: 10_000 }, 1_100);

    expect(getProgressFor(FILE)?.rateBps).toBe(1_000);
  });

  it("le lissage amortit une seconde deux fois plus rapide", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: 100_000 }, 0);
    updateProgress(FILE, { bytesDone: 1_000, expectedSize: 100_000 }, 1_000);
    updateProgress(FILE, { bytesDone: 3_000, expectedSize: 100_000 }, 2_000);

    // 1 000 + 0,3 x (2 000 - 1 000) : le chiffre affiche ne double pas d'un coup.
    expect(getProgressFor(FILE)?.rateBps).toBe(1_300);
  });

  it("un recul invalide la mesure au lieu d'inventer un debit negatif", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: 10_000 }, 0);
    updateProgress(FILE, { bytesDone: 5_000, expectedSize: 10_000 }, 1_000);
    // La reprise est repartie de zero.
    updateProgress(FILE, { bytesDone: 0, expectedSize: 10_000 }, 2_000);

    expect(getProgressFor(FILE)?.rateBps).toBeNull();
    expect(getProgressFor(FILE)?.etaMs).toBeNull();
  });
});

describe("temps restant", () => {
  it("sans total, il n'y a rien a estimer", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: null }, 0);
    updateProgress(FILE, { bytesDone: 1_000, expectedSize: null }, 1_000);

    expect(getProgressFor(FILE)?.rateBps).toBe(1_000);
    expect(getProgressFor(FILE)?.etaMs).toBeNull();
  });

  it("un transfert deja fini n'affiche pas un reste negatif", () => {
    updateProgress(FILE, { bytesDone: 0, expectedSize: 1_000 }, 0);
    // Le fichier depasse l'estimation : l'Allege n'a qu'une approximation.
    updateProgress(FILE, { bytesDone: 1_500, expectedSize: 1_000 }, 1_000);

    expect(getProgressFor(FILE)?.etaMs).toBe(0);
  });
});
