import { describe, expect, it, vi } from "vitest";
import { creerMachineScrub, PAS_SCRUB_S, type OptionsMachineScrub } from "./machineScrub";

/**
 * Ce qui se vérifie ici ne se voit pas à l'œil.
 *
 * Un curseur fantôme qui déplace la lecture à chaque flèche a l'air correct
 * tant qu'on le regarde sur un fichier local ; sur un flux transcodé, c'est une
 * rafale de reconstructions d'URL pour arriver quelque part qu'on n'a même pas
 * visé. L'invariant — **annuler ne déplace jamais** — est le seul rempart, et
 * il est invisible.
 */

function harnais(position = 100, duree = 1000) {
  const options: OptionsMachineScrub = {
    lirePosition: () => position,
    lireDuree: () => duree,
    surEntree: vi.fn(),
    surChangement: vi.fn(),
    surPause: vi.fn(),
    surSeek: vi.fn(),
    surSortie: vi.fn(),
  };
  return { options, machine: creerMachineScrub(options) };
}

describe("machineScrub", () => {
  it("ne déplace rien tant qu'on n'a pas confirmé", () => {
    const { options, machine } = harnais();

    machine.pas(1, 1);
    machine.pas(1, 1);
    machine.pas(1, 1);

    expect(options.surSeek).not.toHaveBeenCalled();
    expect(machine.estActif()).toBe(true);
    machine.detruire();
  });

  it("entrer pose le curseur où l'on en est, sans avancer d'un pas", () => {
    const { options, machine } = harnais(100, 1000);

    machine.entrer();

    expect(machine.estActif()).toBe(true);
    expect(options.surEntree).toHaveBeenCalledWith(100, 1);
    expect(options.surPause).toHaveBeenCalledWith(true);
    // Le bouton dit « je veux me déplacer », pas encore « où » : rien ne bouge
    // tant qu'une flèche n'a pas donné de direction.
    expect(options.surChangement).not.toHaveBeenCalled();
    machine.detruire();
  });

  it("entrer deux fois de suite ne réamorce pas ce qui est déjà en cours", () => {
    const { options, machine } = harnais(100, 1000);

    machine.entrer();
    machine.pas(1, 1);
    machine.entrer();

    expect(options.surEntree).toHaveBeenCalledTimes(1);
    expect(options.surChangement).toHaveBeenLastCalledWith(100 + PAS_SCRUB_S, 1);
    machine.detruire();
  });

  it("met en pause en entrant, et reprend en sortant", () => {
    const { options, machine } = harnais();

    machine.pas(1, 1);
    expect(options.surPause).toHaveBeenCalledWith(true);

    machine.confirmer();
    expect(options.surPause).toHaveBeenLastCalledWith(false);
    machine.detruire();
  });

  it("confirme à la position visée, une seule fois", () => {
    const { options, machine } = harnais(100, 1000);

    machine.pas(1, 1);
    machine.pas(1, 1);
    machine.confirmer();

    expect(options.surSeek).toHaveBeenCalledTimes(1);
    expect(options.surSeek).toHaveBeenCalledWith(100 + 2 * PAS_SCRUB_S);
    machine.detruire();
  });

  it("annule sans jamais déplacer", () => {
    const { options, machine } = harnais();

    machine.pas(1, 4);
    machine.pas(1, 4);
    machine.annuler();

    expect(options.surSeek).not.toHaveBeenCalled();
    expect(options.surPause).toHaveBeenLastCalledWith(false);
    expect(machine.estActif()).toBe(false);
    machine.detruire();
  });

  it("annule seule après un long silence, toujours sans déplacer", () => {
    vi.useFakeTimers();
    const { options, machine } = harnais();

    machine.pas(1, 1);
    vi.advanceTimersByTime(7100);

    expect(options.surSeek).not.toHaveBeenCalled();
    expect(machine.estActif()).toBe(false);
    machine.detruire();
    vi.useRealTimers();
  });

  it("borne la position au flux, jamais au-delà ni en deçà", () => {
    const { options, machine } = harnais(5, 60);

    machine.pas(-1, 8);
    machine.confirmer();
    expect(options.surSeek).toHaveBeenCalledWith(0);

    const second = harnais(55, 60);
    second.machine.pas(1, 8);
    second.machine.confirmer();
    expect(second.options.surSeek).toHaveBeenCalledWith(60);

    machine.detruire();
    second.machine.detruire();
  });

  it("un palier plus haut avance plus vite, sans changer le nombre de sauts", () => {
    const lent = harnais(0, 10000);
    const rapide = harnais(0, 10000);

    lent.machine.pas(1, 1);
    rapide.machine.pas(1, 8);
    lent.machine.confirmer();
    rapide.machine.confirmer();

    expect(lent.options.surSeek).toHaveBeenCalledWith(PAS_SCRUB_S);
    expect(rapide.options.surSeek).toHaveBeenCalledWith(PAS_SCRUB_S * 8);

    lent.machine.detruire();
    rapide.machine.detruire();
  });

  it("confirmer ou annuler hors déplacement ne fait rien", () => {
    const { options, machine } = harnais();

    machine.confirmer();
    machine.annuler();

    expect(options.surSeek).not.toHaveBeenCalled();
    expect(options.surPause).not.toHaveBeenCalled();
    expect(options.surSortie).not.toHaveBeenCalled();
    machine.detruire();
  });
});
