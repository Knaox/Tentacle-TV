import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPress } from "./longPress";

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
const OK_BY_NAME = { keyCode: 0, key: "Enter", preventDefault: () => {} };
const ARROW = { keyCode: 39, preventDefault: () => {} };

describe("createLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("joue l'appui court au relâchement", () => {
    const short = vi.fn();
    const press = createLongPress({ short });

    press.onKeyDown(OK);
    vi.advanceTimersByTime(120);
    press.onKeyUp(OK);

    expect(short).toHaveBeenCalledTimes(1);
  });

  it("joue l'appui court même tenu longtemps, sans action longue", () => {
    // Le défaut. Sur une affiche, l'appui court ouvre déjà la fiche : aucun
    // maintien n'est déclaré. Tenir OK une seconde ne faisait alors rien.
    const short = vi.fn();
    const press = createLongPress({ short });

    press.onKeyDown(OK);
    vi.advanceTimersByTime(1000);
    press.onKeyUp(OK);

    expect(short).toHaveBeenCalledTimes(1);
  });

  it("déclenche le maintien au seuil, sans attendre le relâchement", () => {
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK);
    vi.advanceTimersByTime(600);

    expect(long).toHaveBeenCalledTimes(1);
    expect(short).not.toHaveBeenCalled();
  });

  it("ne rejoue pas l'appui court en relâchant après un maintien", () => {
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK);
    vi.advanceTimersByTime(600);
    press.onKeyUp(OK);

    expect(long).toHaveBeenCalledTimes(1);
    expect(short).not.toHaveBeenCalled();
  });

  it("garde l'appui court quand on relâche avant le seuil", () => {
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK);
    vi.advanceTimersByTime(200);
    press.onKeyUp(OK);

    expect(short).toHaveBeenCalledTimes(1);
    expect(long).not.toHaveBeenCalled();
  });

  it("déduit le relâchement du silence, faute de keyup", () => {
    // Certains modèles ne notifient pas de `keyup`. La répétition automatique
    // prouve que la touche est tenue ; son arrêt vaut relâchement.
    const short = vi.fn();
    const press = createLongPress({ short });

    press.onKeyDown(OK);
    press.onKeyDown(OK);
    expect(press.didRepeat()).toBe(true);

    vi.advanceTimersByTime(800);
    expect(short).toHaveBeenCalledTimes(1);
  });

  it("annule tout quand une flèche survient pendant l'appui", () => {
    // L'utilisateur a changé d'avis, il n'a pas confirmé.
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK);
    press.onKeyDown(ARROW);
    vi.advanceTimersByTime(1000);
    press.onKeyUp(OK);

    expect(short).not.toHaveBeenCalled();
    expect(long).not.toHaveBeenCalled();
  });

  it("n'arme rien pour la carte suivante après une navigation", () => {
    // Le `keyup` arriverait sur un élément démonté ; `onBlur` remet à zéro.
    const short = vi.fn();
    const press = createLongPress({ short });

    press.onKeyDown(OK);
    press.onBlur();
    press.onKeyUp(OK);

    expect(short).not.toHaveBeenCalled();
  });

  it("reconnaît Entrée par son nom quand keyCode vaut zéro", () => {
    // La fragilité mesurée au banc d'essai : les événements y portent
    // `keyCode: 0`, et ne lire que le code prenait chaque répétition d'Entrée
    // pour un déplacement — la première annulait le maintien.
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK_BY_NAME);
    press.onKeyDown(OK_BY_NAME);
    vi.advanceTimersByTime(600);
    press.onKeyUp(OK_BY_NAME);

    expect(long).toHaveBeenCalledTimes(1);
    expect(short).not.toHaveBeenCalled();
  });

  it("joue l'appui court par le nom aussi", () => {
    const short = vi.fn();
    const press = createLongPress({ short });

    press.onKeyDown(OK_BY_NAME);
    vi.advanceTimersByTime(120);
    press.onKeyUp(OK_BY_NAME);

    expect(short).toHaveBeenCalledTimes(1);
  });

  it("annule le maintien sur une flèche nommée sans keyCode", () => {
    const short = vi.fn();
    const long = vi.fn();
    const press = createLongPress({ short, long });

    press.onKeyDown(OK_BY_NAME);
    press.onKeyDown({ keyCode: 0, key: "ArrowRight", preventDefault: () => {} });
    vi.advanceTimersByTime(1000);

    expect(long).not.toHaveBeenCalled();
  });
});
