/**
 * L'invariant tenu ici : la maximisation de sortie ne s'applique QUE là où
 * elle est légitime — Linux, montage à fenêtré libre (colle KDE) ou X11, plein
 * écran posé PENDANT la lecture. Tout le reste rend « rien » : le montage
 * imposé garde sa propre restauration, macOS/Windows gardent leurs chemins,
 * et un F11 antérieur à la lecture appartient à l'utilisateur.
 */

import { describe, expect, it } from "vitest";
import { decidePlayerExitAction, type PlayerExitInput } from "./playerExitWindowState";

function entree(sur: Partial<PlayerExitInput>): PlayerExitInput {
  return {
    platform: "linux",
    montage: "wayland",
    fenetrage: "libre",
    dejaEnPleinEcran: false,
    enPleinEcran: true,
    ...sur,
  };
}

describe("decidePlayerExitAction", () => {
  it("colle KDE, plein écran du film : quitter puis maximiser", () => {
    expect(decidePlayerExitAction(entree({}))).toBe("quitterPleinEcranPuisMaximiser");
  });

  it("X11 aussi : le plein écran du film se rend", () => {
    expect(decidePlayerExitAction(entree({ montage: "x11", fenetrage: null })))
      .toBe("quitterPleinEcranPuisMaximiser");
  });

  it("montage imposé (GNOME/wlroots) : la surface possède la restauration", () => {
    expect(decidePlayerExitAction(entree({ fenetrage: "plein-ecran" }))).toBe("rien");
  });

  it("montage inconnu : ne rien toucher", () => {
    expect(decidePlayerExitAction(entree({ montage: null }))).toBe("rien");
  });

  it("un F11 antérieur à la lecture appartient à l'utilisateur", () => {
    expect(decidePlayerExitAction(entree({ dejaEnPleinEcran: true }))).toBe("rien");
  });

  it("aucune session lecteur ouverte : rien à défaire", () => {
    expect(decidePlayerExitAction(entree({ dejaEnPleinEcran: null }))).toBe("rien");
  });

  it("fenêtrée à la sortie : rien à faire", () => {
    expect(decidePlayerExitAction(entree({ enPleinEcran: false }))).toBe("rien");
  });

  it("macOS et Windows gardent leurs chemins", () => {
    expect(decidePlayerExitAction(entree({ platform: "darwin" }))).toBe("rien");
    expect(decidePlayerExitAction(entree({ platform: "win32" }))).toBe("rien");
  });
});
