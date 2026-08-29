import { describe, expect, it, vi } from "vitest";
import { createScrubMachine, SCRUB_STEP_S, type ScrubMachineOptions } from "./scrubMachine";

/**
 * Ce qui se vérifie ici ne se voit pas à l'œil.
 *
 * Un curseur fantôme qui déplace la lecture à chaque flèche a l'air correct
 * tant qu'on le regarde sur un fichier local ; sur un flux transcodé, c'est une
 * rafale de reconstructions d'URL pour arriver quelque part qu'on n'a même pas
 * visé. L'invariant — **annuler ne déplace jamais** — est le seul rempart, et
 * il est invisible.
 */

// 500 s (~8 min) : sous le seuil proportionnel — le pas vaut le plancher
// historique de dix secondes, les invariants de la machine se lisent en clair.
function harness(position = 100, duration = 500) {
  const options: ScrubMachineOptions = {
    readPosition: () => position,
    readDuration: () => duration,
    onEnter: vi.fn(),
    onChange: vi.fn(),
    onPause: vi.fn(),
    onSeek: vi.fn(),
    onExit: vi.fn(),
  };
  return { options, machine: createScrubMachine(options) };
}

describe("scrubMachine", () => {
  it("ne déplace rien tant qu'on n'a pas confirmé", () => {
    const { options, machine } = harness();

    machine.step(1, 1);
    machine.step(1, 1);
    machine.step(1, 1);

    expect(options.onSeek).not.toHaveBeenCalled();
    expect(machine.isActive()).toBe(true);
    machine.destroy();
  });

  it("entrer pose le curseur où l'on en est, sans avancer d'un pas", () => {
    const { options, machine } = harness(100, 500);

    machine.enter();

    expect(machine.isActive()).toBe(true);
    expect(options.onEnter).toHaveBeenCalledWith(100, 1);
    expect(options.onPause).toHaveBeenCalledWith(true);
    // Le bouton dit « je veux me déplacer », pas encore « où » : rien ne bouge
    // tant qu'une flèche n'a pas donné de direction.
    expect(options.onChange).not.toHaveBeenCalled();
    machine.destroy();
  });

  it("entrer deux fois de suite ne réamorce pas ce qui est déjà en cours", () => {
    const { options, machine } = harness(100, 500);

    machine.enter();
    machine.step(1, 1);
    machine.enter();

    expect(options.onEnter).toHaveBeenCalledTimes(1);
    expect(options.onChange).toHaveBeenLastCalledWith(100 + SCRUB_STEP_S, 1);
    machine.destroy();
  });

  it("met en pause en entrant, et reprend en sortant", () => {
    const { options, machine } = harness();

    machine.step(1, 1);
    expect(options.onPause).toHaveBeenCalledWith(true);

    machine.confirm();
    expect(options.onPause).toHaveBeenLastCalledWith(false);
    machine.destroy();
  });

  it("confirme à la position visée, une seule fois", () => {
    const { options, machine } = harness(100, 500);

    machine.step(1, 1);
    machine.step(1, 1);
    machine.confirm();

    expect(options.onSeek).toHaveBeenCalledTimes(1);
    expect(options.onSeek).toHaveBeenCalledWith(100 + 2 * SCRUB_STEP_S);
    machine.destroy();
  });

  it("annule sans jamais déplacer", () => {
    const { options, machine } = harness();

    machine.step(1, 4);
    machine.step(1, 4);
    machine.cancel();

    expect(options.onSeek).not.toHaveBeenCalled();
    expect(options.onPause).toHaveBeenLastCalledWith(false);
    expect(machine.isActive()).toBe(false);
    machine.destroy();
  });

  it("annule seule après un long silence, toujours sans déplacer", () => {
    vi.useFakeTimers();
    const { options, machine } = harness();

    machine.step(1, 1);
    vi.advanceTimersByTime(7100);

    expect(options.onSeek).not.toHaveBeenCalled();
    expect(machine.isActive()).toBe(false);
    machine.destroy();
    vi.useRealTimers();
  });

  it("borne la position au flux, jamais au-delà ni en deçà", () => {
    const { options, machine } = harness(5, 60);

    machine.step(-1, 8);
    machine.confirm();
    expect(options.onSeek).toHaveBeenCalledWith(0);

    const second = harness(55, 60);
    second.machine.step(1, 8);
    second.machine.confirm();
    expect(second.options.onSeek).toHaveBeenCalledWith(60);

    machine.destroy();
    second.machine.destroy();
  });

  it("un palier plus haut avance plus vite, sans changer le nombre de sauts", () => {
    // 10 000 s (~2 h 46) → pas de base plafonné à 90 s (scrubStep) : le
    // rapport ×8 entre paliers, lui, est l'invariant que ce test protège.
    const slow = harness(0, 10000);
    const fast = harness(0, 10000);

    slow.machine.step(1, 1);
    fast.machine.step(1, 8);
    slow.machine.confirm();
    fast.machine.confirm();

    expect(slow.options.onSeek).toHaveBeenCalledWith(90);
    expect(fast.options.onSeek).toHaveBeenCalledWith(90 * 8);

    slow.machine.destroy();
    fast.machine.destroy();
  });

  it("confirmer ou annuler hors déplacement ne fait rien", () => {
    const { options, machine } = harness();

    machine.confirm();
    machine.cancel();

    expect(options.onSeek).not.toHaveBeenCalled();
    expect(options.onPause).not.toHaveBeenCalled();
    expect(options.onExit).not.toHaveBeenCalled();
    machine.destroy();
  });
});

describe("pas proportionnel à la durée", () => {
  it("avance de 60 s par pas sur un film de 50 minutes (2 % de la durée)", () => {
    const { options, machine } = harness(100, 50 * 60);

    machine.step(1, 1);

    expect(options.onChange).toHaveBeenLastCalledWith(160, 1);
    machine.destroy();
  });

  it("garde le pas historique de 10 s sur un contenu court", () => {
    const { options, machine } = harness(30, 180);

    machine.step(1, 1);

    expect(options.onChange).toHaveBeenLastCalledWith(30 + SCRUB_STEP_S, 1);
    machine.destroy();
  });
});
