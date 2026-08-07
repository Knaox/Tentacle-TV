import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerMoteurMaintien, REPETITIONS_AVANT_TIC, TIC_MAINTIEN_MS } from "./moteurMaintien";

/**
 * Taper ou tenir — la distinction, et rien d'autre.
 *
 * Le module rend deux gestes très différents à partir d'un flux d'événements où
 * rien ne les déclare : on tape, c'est un saut sec ; on tient, c'est le curseur
 * fantôme qui part et accélère. Se tromper de lecture ne produit pas une erreur
 * mais un lecteur qui désobéit — une avance rapide déclenchée par deux appuis,
 * ou l'inverse, une touche tenue qui ne fait que sauter.
 *
 * Séparé des tests de cadence : ceux-là mesurent le DÉBIT une fois le maintien
 * engagé, ceux-ci décident s'il l'est.
 */

interface Pas {
  instant: number;
  sens: 1 | -1;
  palier: number;
  geste: "saut" | "tic";
}

function harnais() {
  const depart = Date.now();
  const pas: Pas[] = [];
  const moteur = creerMoteurMaintien({
    sauter: (sens) => pas.push({ instant: Date.now() - depart, sens, palier: 0, geste: "saut" }),
    avancer: (sens, palier) => pas.push({ instant: Date.now() - depart, sens, palier, geste: "tic" }),
  });
  return {
    pas,
    moteur,
    sauts: () => pas.filter((p) => p.geste === "saut"),
    tics: () => pas.filter((p) => p.geste === "tic"),
  };
}

/** Un maintien : un appui, puis des répétitions à `intervalle` pendant `duree`. */
function tenir(
  moteur: ReturnType<typeof creerMoteurMaintien>,
  code: number,
  sens: 1 | -1,
  intervalle: number,
  duree: number,
): void {
  moteur.appuyer(code, sens);
  for (let ecoule = intervalle; ecoule <= duree; ecoule += intervalle) {
    vi.advanceTimersByTime(intervalle);
    moteur.appuyer(code, sens);
  }
}

const DROITE = 39;

describe("moteurMaintien — taper ou tenir", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("deux appuis distincts font deux sauts, même rapprochés", () => {
    const { pas, moteur, tics } = harnais();

    // Trois cents millisecondes : le geste de quelqu'un qui tape deux fois sur
    // la même flèche. Sous l'ancien seuil de silence (700 ms) c'était pris pour
    // une auto-répétition, et deux sauts demandés donnaient une avance rapide.
    moteur.appuyer(DROITE, 1);
    vi.advanceTimersByTime(300);
    moteur.appuyer(DROITE, 1);

    expect(pas).toHaveLength(2);
    expect(pas.every((p) => p.geste === "saut")).toBe(true);

    // Et surtout : aucun déplacement ne part derrière.
    vi.advanceTimersByTime(2000);
    expect(tics()).toHaveLength(0);
    moteur.detruire();
  });

  it("une auto-répétition, elle, engage bien le maintien", () => {
    const { pas, moteur } = harnais();

    // Une touche tenue insiste : c'est cela qu'on reconnaît, et non une
    // cadence particulière — celle d'une dalle LG n'est pas prévisible.
    moteur.appuyer(DROITE, 1);
    for (let i = 0; i < REPETITIONS_AVANT_TIC; i++) {
      vi.advanceTimersByTime(300);
      moteur.appuyer(DROITE, 1);
    }
    const avant = pas.length;

    // Le tic possède l'avance à partir d'ici.
    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 3);

    expect(pas.length).toBeGreaterThan(avant);
    moteur.detruire();
  });

  it("une touche déclarée TENUE engage le tic, si lente que soit la dalle", () => {
    const { pas, moteur, sauts, tics } = harnais();

    // Cadence bien au-delà de tout seuil raisonnable. Sans le signal `repeat`,
    // chaque battement retombait en « nouvel appui » : le maintien ne donnait
    // qu'une rafale de sauts, l'habillage restait à l'écran faute d'entrer en
    // déplacement, et la position bougeait par bonds sans validation.
    moteur.appuyer(DROITE, 1);
    vi.advanceTimersByTime(900);
    moteur.appuyer(DROITE, 1, true);
    const avant = pas.length;

    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 3);

    expect(tics().length).toBeGreaterThan(0);
    expect(pas.length).toBeGreaterThan(avant);
    // Le battement qui engage ne saute pas : un seul saut, celui de l'appui.
    expect(sauts()).toHaveLength(1);
    moteur.detruire();
  });

  it("une dalle qui répète lentement garde son avance rapide", () => {
    const { pas, moteur } = harnais();

    // 400 ms de cadence — le module rappelle que celle d'un téléviseur LG
    // n'est ni documentée ni constante. Un simple plafond de vitesse aurait
    // fait disparaître l'avance rapide sur ce modèle-là.
    tenir(moteur, DROITE, 1, 400, 1600);
    const avant = pas.length;

    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 2);

    expect(pas.length).toBeGreaterThan(avant);
    moteur.detruire();
  });

});
