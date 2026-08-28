/**
 * L'invariant tenu ici : à la fermeture de session sur Linux (colle KDE), le
 * plein écran du FILM se rend en fenêtre maximisée — `quitter` d'abord, le
 * `maximize` sur l'évènement de sortie (l'écriture est asynchrone sur
 * Wayland) — et un plein écran antérieur à la lecture reste intouché.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

const h = vi.hoisted(() => ({
  enPleinEcran: false,
  quitter: vi.fn(),
  noterFenetre: vi.fn(),
  montage: "wayland" as "wayland" | "x11" | null,
  fenetrage: "libre" as "libre" | "plein-ecran" | null,
}));

vi.mock("./fullscreen", () => ({
  PARADE_WINDOWS: false,
  estEnPleinEcran: () => h.enPleinEcran,
  noterFenetre: h.noterFenetre,
  quitter: h.quitter,
}));

vi.mock("./linux/session", () => ({
  montageLinux: () => h.montage,
  fenetrageLinux: () => h.fenetrage,
}));

import { fermerSessionLecteur, ouvrirSessionLecteur } from "./sessionLecteurPleinEcran";

/** Fenêtre jouée : capture le `once("leave-full-screen")` pour le déclencher. */
function fenetre() {
  const ecouteurs: Record<string, () => void> = {};
  return {
    detruite: false,
    maximize: vi.fn(),
    isDestroyed(): boolean { return this.detruite; },
    once(evenement: string, cb: () => void): void { ecouteurs[evenement] = cb; },
    emettre(evenement: string): void { ecouteurs[evenement]?.(); },
  };
}

const plateformeInitiale = process.platform;
function poserPlateforme(p: string): void {
  Object.defineProperty(process, "platform", { value: p });
}

beforeEach(() => {
  h.enPleinEcran = false;
  h.montage = "wayland";
  h.fenetrage = "libre";
  h.quitter.mockClear();
  h.noterFenetre.mockClear();
  poserPlateforme("linux");
  return () => poserPlateforme(plateformeInitiale);
});

describe("fermerSessionLecteur — Linux, colle KDE", () => {
  it("plein écran né pendant la lecture : quitter, puis maximiser à la sortie", () => {
    const win = fenetre();
    h.enPleinEcran = false;
    ouvrirSessionLecteur(win as unknown as BrowserWindow); // fenêtrée au départ
    h.enPleinEcran = true; // le film a posé le plein écran
    fermerSessionLecteur(win as unknown as BrowserWindow);
    expect(h.quitter).toHaveBeenCalledOnce();
    expect(win.maximize).not.toHaveBeenCalled(); // pas avant l'évènement
    win.emettre("leave-full-screen");
    expect(win.maximize).toHaveBeenCalledOnce();
  });

  it("plein écran antérieur à la lecture : il appartient à l'utilisateur", () => {
    const win = fenetre();
    h.enPleinEcran = true; // DÉJÀ plein écran avant le film
    ouvrirSessionLecteur(win as unknown as BrowserWindow);
    fermerSessionLecteur(win as unknown as BrowserWindow);
    expect(h.quitter).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("fenêtrée à la sortie : rien", () => {
    const win = fenetre();
    ouvrirSessionLecteur(win as unknown as BrowserWindow);
    fermerSessionLecteur(win as unknown as BrowserWindow);
    expect(h.quitter).not.toHaveBeenCalled();
  });

  it("montage imposé : la surface possède la restauration, pas nous", () => {
    const win = fenetre();
    h.fenetrage = "plein-ecran";
    ouvrirSessionLecteur(win as unknown as BrowserWindow);
    h.enPleinEcran = true;
    fermerSessionLecteur(win as unknown as BrowserWindow);
    expect(h.quitter).not.toHaveBeenCalled();
  });

  it("fenêtre détruite entre-temps : le maximize ne part pas", () => {
    const win = fenetre();
    ouvrirSessionLecteur(win as unknown as BrowserWindow);
    h.enPleinEcran = true;
    fermerSessionLecteur(win as unknown as BrowserWindow);
    win.detruite = true;
    win.emettre("leave-full-screen");
    expect(win.maximize).not.toHaveBeenCalled();
  });
});
