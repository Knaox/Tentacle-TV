import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSelectKeyLock } from "./keyLock";

/**
 * Le verrou protège l'écran d'ARRIVÉE d'une action longue : la touche encore
 * tenue ne doit rien y activer. Un défaut ici ne se voit qu'en tenant OK
 * au-delà du seuil — le geste que personne ne fait au clavier et que tout le
 * monde fait télécommande en main : la fiche s'ouvrait, puis le lecteur.
 */

const OK = { keyCode: 13 };
const OK_BY_NAME = { keyCode: 0, key: "Enter" };
const ARROW = { keyCode: 39, key: "ArrowRight" };

describe("createSelectKeyLock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("n'avale rien tant qu'il n'est pas armé", () => {
    const lock = createSelectKeyLock();
    expect(lock.onKeyDown(OK)).toBe(false);
    expect(lock.isArmed()).toBe(false);
  });

  it("avale les répétitions d'OK une fois armé, par code comme par nom", () => {
    const lock = createSelectKeyLock();
    lock.arm();
    expect(lock.onKeyDown(OK)).toBe(true);
    expect(lock.onKeyDown(OK_BY_NAME)).toBe(true);
  });

  it("laisse passer les flèches — elles appartiennent au déplacement", () => {
    const lock = createSelectKeyLock();
    lock.arm();
    expect(lock.onKeyDown(ARROW)).toBe(false);
    expect(lock.isArmed()).toBe(true);
  });

  it("se désarme au relâchement d'OK et prévient son installeur", () => {
    const onDisarm = vi.fn();
    const lock = createSelectKeyLock();
    lock.arm(onDisarm);

    expect(lock.onKeyUp(OK)).toBe(true);
    expect(lock.isArmed()).toBe(false);
    expect(onDisarm).toHaveBeenCalledTimes(1);
    expect(lock.onKeyDown(OK)).toBe(false);
  });

  it("ignore le relâchement d'une autre touche", () => {
    const lock = createSelectKeyLock();
    lock.arm();
    expect(lock.onKeyUp(ARROW)).toBe(false);
    expect(lock.isArmed()).toBe(true);
  });

  it("se désarme au silence, faute de keyup", () => {
    // Certains modèles ne notifient pas le relâchement : sans échéance, un
    // verrou fantôme avalerait l'appui SUIVANT — une touche entière muette.
    const onDisarm = vi.fn();
    const lock = createSelectKeyLock(700);
    lock.arm(onDisarm);

    vi.advanceTimersByTime(800);
    expect(lock.isArmed()).toBe(false);
    expect(onDisarm).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit le silence à chaque répétition avalée", () => {
    // La répétition prouve que la touche est tenue : tant qu'elle arrive, le
    // verrou tient — c'est son travail, même sur un très long maintien.
    const lock = createSelectKeyLock(700);
    lock.arm();

    vi.advanceTimersByTime(500);
    lock.onKeyDown(OK);
    vi.advanceTimersByTime(500);
    expect(lock.isArmed()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(lock.isArmed()).toBe(false);
  });

  it("peut se réarmer pour l'action longue suivante", () => {
    const lock = createSelectKeyLock();
    lock.arm();
    lock.onKeyUp(OK);

    lock.arm();
    expect(lock.onKeyDown(OK)).toBe(true);
  });
});
