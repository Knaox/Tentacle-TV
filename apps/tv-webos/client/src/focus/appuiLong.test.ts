import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerAppuiLong } from "./appuiLong";

/**
 * L'appui sur OK est la seule commande dont la DURÉE change le sens, et c'est
 * ce qui la rend piégeuse : rien à l'écran ne distingue un appui bref d'un
 * appui appuyé, et un défaut ne se voit qu'en tenant la touche — un geste que
 * personne ne fait en testant au clavier, et que tout le monde fait avec une
 * télécommande à la main.
 *
 * Le défaut que ces tests ferment : sans action longue déclarée, **tout appui
 * de plus de 550 ms ne faisait rien du tout**. L'état « la touche est
 * enfoncée » se déduisait de la présence du minuteur, or aucun minuteur n'est
 * armé quand il n'y a pas de maintien à déclencher.
 */

const OK = { keyCode: 13, preventDefault: () => {} };
const FLECHE = { keyCode: 39, preventDefault: () => {} };

describe("creerAppuiLong", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("joue l'appui court au relâchement", () => {
    const court = vi.fn();
    const appui = creerAppuiLong({ court });

    appui.onKeyDown(OK);
    vi.advanceTimersByTime(120);
    appui.onKeyUp(OK);

    expect(court).toHaveBeenCalledTimes(1);
  });

  it("joue l'appui court même tenu longtemps, sans action longue", () => {
    // Le défaut. Sur une affiche, l'appui court ouvre déjà la fiche : aucun
    // maintien n'est déclaré. Tenir OK une seconde ne faisait alors rien.
    const court = vi.fn();
    const appui = creerAppuiLong({ court });

    appui.onKeyDown(OK);
    vi.advanceTimersByTime(1000);
    appui.onKeyUp(OK);

    expect(court).toHaveBeenCalledTimes(1);
  });

  it("déclenche le maintien au seuil, sans attendre le relâchement", () => {
    const court = vi.fn();
    const long = vi.fn();
    const appui = creerAppuiLong({ court, long });

    appui.onKeyDown(OK);
    vi.advanceTimersByTime(600);

    expect(long).toHaveBeenCalledTimes(1);
    expect(court).not.toHaveBeenCalled();
  });

  it("ne rejoue pas l'appui court en relâchant après un maintien", () => {
    const court = vi.fn();
    const long = vi.fn();
    const appui = creerAppuiLong({ court, long });

    appui.onKeyDown(OK);
    vi.advanceTimersByTime(600);
    appui.onKeyUp(OK);

    expect(long).toHaveBeenCalledTimes(1);
    expect(court).not.toHaveBeenCalled();
  });

  it("garde l'appui court quand on relâche avant le seuil", () => {
    const court = vi.fn();
    const long = vi.fn();
    const appui = creerAppuiLong({ court, long });

    appui.onKeyDown(OK);
    vi.advanceTimersByTime(200);
    appui.onKeyUp(OK);

    expect(court).toHaveBeenCalledTimes(1);
    expect(long).not.toHaveBeenCalled();
  });

  it("déduit le relâchement du silence, faute de keyup", () => {
    // Certains modèles ne notifient pas de `keyup`. La répétition automatique
    // prouve que la touche est tenue ; son arrêt vaut relâchement.
    const court = vi.fn();
    const appui = creerAppuiLong({ court });

    appui.onKeyDown(OK);
    appui.onKeyDown(OK);
    expect(appui.aRepete()).toBe(true);

    vi.advanceTimersByTime(800);
    expect(court).toHaveBeenCalledTimes(1);
  });

  it("annule tout quand une flèche survient pendant l'appui", () => {
    // L'utilisateur a changé d'avis, il n'a pas confirmé.
    const court = vi.fn();
    const long = vi.fn();
    const appui = creerAppuiLong({ court, long });

    appui.onKeyDown(OK);
    appui.onKeyDown(FLECHE);
    vi.advanceTimersByTime(1000);
    appui.onKeyUp(OK);

    expect(court).not.toHaveBeenCalled();
    expect(long).not.toHaveBeenCalled();
  });

  it("n'arme rien pour la carte suivante après une navigation", () => {
    // Le `keyup` arriverait sur un élément démonté ; `onBlur` remet à zéro.
    const court = vi.fn();
    const appui = creerAppuiLong({ court });

    appui.onKeyDown(OK);
    appui.onBlur();
    appui.onKeyUp(OK);

    expect(court).not.toHaveBeenCalled();
  });
});
