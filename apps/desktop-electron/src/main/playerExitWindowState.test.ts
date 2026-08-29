/**
 * L'invariant tenu ici : la maximisation de sortie ne s'applique QUE là où
 * elle est légitime — Linux, montage à fenêtré libre (colle KDE) ou X11, plein
 * écran posé PENDANT la lecture. Tout le reste rend « rien » : le montage
 * imposé garde sa propre restauration, macOS/Windows gardent leurs chemins,
 * et un F11 antérieur à la lecture appartient à l'utilisateur.
 */

import { describe, expect, it } from "vitest";
import { decidePlayerExitAction, type PlayerExitInput } from "./playerExitWindowState";

function entry(given: Partial<PlayerExitInput>): PlayerExitInput {
  return {
    platform: "linux",
    montage: "wayland",
    windowing: "libre",
    alreadyFullscreen: false,
    fullscreen: true,
    ...given,
  };
}

describe("decidePlayerExitAction", () => {
  it("colle KDE, plein écran du film : quitter puis maximiser", () => {
    expect(decidePlayerExitAction(entry({}))).toBe("exitFullscreenThenMaximize");
  });

  it("X11 aussi : le plein écran du film se rend", () => {
    expect(decidePlayerExitAction(entry({ montage: "x11", windowing: null })))
      .toBe("exitFullscreenThenMaximize");
  });

  it("montage imposé (GNOME/wlroots) : la surface possède la restauration", () => {
    expect(decidePlayerExitAction(entry({ windowing: "plein-ecran" }))).toBe("none");
  });

  it("montage inconnu : ne rien toucher", () => {
    expect(decidePlayerExitAction(entry({ montage: null }))).toBe("none");
  });

  it("un F11 antérieur à la lecture appartient à l'utilisateur", () => {
    expect(decidePlayerExitAction(entry({ alreadyFullscreen: true }))).toBe("none");
  });

  it("aucune session lecteur ouverte : rien à défaire", () => {
    expect(decidePlayerExitAction(entry({ alreadyFullscreen: null }))).toBe("none");
  });

  it("fenêtrée à la sortie : rien à faire", () => {
    expect(decidePlayerExitAction(entry({ fullscreen: false }))).toBe("none");
  });

  it("macOS et Windows gardent leurs chemins", () => {
    expect(decidePlayerExitAction(entry({ platform: "darwin" }))).toBe("none");
    expect(decidePlayerExitAction(entry({ platform: "win32" }))).toBe("none");
  });
});
