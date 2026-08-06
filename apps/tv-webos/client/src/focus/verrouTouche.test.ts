import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerVerrouOk } from "./verrouTouche";

/**
 * Le verrou protège l'écran d'ARRIVÉE d'une action longue : la touche encore
 * tenue ne doit rien y activer. Un défaut ici ne se voit qu'en tenant OK
 * au-delà du seuil — le geste que personne ne fait au clavier et que tout le
 * monde fait télécommande en main : la fiche s'ouvrait, puis le lecteur.
 */

const OK = { keyCode: 13 };
const OK_PAR_NOM = { keyCode: 0, key: "Enter" };
const FLECHE = { keyCode: 39, key: "ArrowRight" };

describe("creerVerrouOk", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("n'avale rien tant qu'il n'est pas armé", () => {
    const verrou = creerVerrouOk();
    expect(verrou.surKeydown(OK)).toBe(false);
    expect(verrou.estArme()).toBe(false);
  });

  it("avale les répétitions d'OK une fois armé, par code comme par nom", () => {
    const verrou = creerVerrouOk();
    verrou.armer();
    expect(verrou.surKeydown(OK)).toBe(true);
    expect(verrou.surKeydown(OK_PAR_NOM)).toBe(true);
  });

  it("laisse passer les flèches — elles appartiennent au déplacement", () => {
    const verrou = creerVerrouOk();
    verrou.armer();
    expect(verrou.surKeydown(FLECHE)).toBe(false);
    expect(verrou.estArme()).toBe(true);
  });

  it("se désarme au relâchement d'OK et prévient son installeur", () => {
    const surDesarmement = vi.fn();
    const verrou = creerVerrouOk();
    verrou.armer(surDesarmement);

    expect(verrou.surKeyup(OK)).toBe(true);
    expect(verrou.estArme()).toBe(false);
    expect(surDesarmement).toHaveBeenCalledTimes(1);
    expect(verrou.surKeydown(OK)).toBe(false);
  });

  it("ignore le relâchement d'une autre touche", () => {
    const verrou = creerVerrouOk();
    verrou.armer();
    expect(verrou.surKeyup(FLECHE)).toBe(false);
    expect(verrou.estArme()).toBe(true);
  });

  it("se désarme au silence, faute de keyup", () => {
    // Certains modèles ne notifient pas le relâchement : sans échéance, un
    // verrou fantôme avalerait l'appui SUIVANT — une touche entière muette.
    const surDesarmement = vi.fn();
    const verrou = creerVerrouOk(700);
    verrou.armer(surDesarmement);

    vi.advanceTimersByTime(800);
    expect(verrou.estArme()).toBe(false);
    expect(surDesarmement).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit le silence à chaque répétition avalée", () => {
    // La répétition prouve que la touche est tenue : tant qu'elle arrive, le
    // verrou tient — c'est son travail, même sur un très long maintien.
    const verrou = creerVerrouOk(700);
    verrou.armer();

    vi.advanceTimersByTime(500);
    verrou.surKeydown(OK);
    vi.advanceTimersByTime(500);
    expect(verrou.estArme()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(verrou.estArme()).toBe(false);
  });

  it("peut se réarmer pour l'action longue suivante", () => {
    const verrou = creerVerrouOk();
    verrou.armer();
    verrou.surKeyup(OK);

    verrou.armer();
    expect(verrou.surKeydown(OK)).toBe(true);
  });
});
