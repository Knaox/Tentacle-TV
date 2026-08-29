/**
 * L'invariant tenu ici : à la fermeture de session sur Linux (colle KDE), le
 * plein écran du FILM se rend en fenêtre maximisée — `leave` d'abord, le
 * `maximize` sur l'évènement de sortie (l'écriture est asynchrone sur
 * Wayland) — et un plein écran antérieur à la lecture reste intouché.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

const h = vi.hoisted(() => ({
  fullscreen: false,
  leave: vi.fn(),
  noteWindow: vi.fn(),
  montage: "wayland" as "wayland" | "x11" | null,
  windowing: "libre" as "libre" | "plein-ecran" | null,
}));

vi.mock("./fullscreen", () => ({
  WINDOWS_WORKAROUND: false,
  isFullscreen: () => h.fullscreen,
  noteWindow: h.noteWindow,
  leave: h.leave,
}));

vi.mock("./linux/session", () => ({
  linuxMontage: () => h.montage,
  linuxWindowing: () => h.windowing,
}));

import { closePlayerSession, openPlayerSession } from "./playerFullscreenSession";

/** Fenêtre jouée : capture le `once("leave-full-screen")` pour le déclencher. */
function window() {
  const listeners: Record<string, () => void> = {};
  return {
    destroyed: false,
    maximize: vi.fn(),
    isDestroyed(): boolean { return this.destroyed; },
    once(event: string, cb: () => void): void { listeners[event] = cb; },
    emit(event: string): void { listeners[event]?.(); },
  };
}

const initialPlatform = process.platform;
function setPlatform(p: string): void {
  Object.defineProperty(process, "platform", { value: p });
}

beforeEach(() => {
  h.fullscreen = false;
  h.montage = "wayland";
  h.windowing = "libre";
  h.leave.mockClear();
  h.noteWindow.mockClear();
  setPlatform("linux");
  return () => setPlatform(initialPlatform);
});

describe("fermerSessionLecteur — Linux, colle KDE", () => {
  it("plein écran né pendant la lecture : quitter, puis maximiser à la sortie", () => {
    const win = window();
    h.fullscreen = false;
    openPlayerSession(win as unknown as BrowserWindow); // fenêtrée au départ
    h.fullscreen = true; // le film a posé le plein écran
    closePlayerSession(win as unknown as BrowserWindow);
    expect(h.leave).toHaveBeenCalledOnce();
    expect(win.maximize).not.toHaveBeenCalled(); // pas avant l'évènement
    win.emit("leave-full-screen");
    expect(win.maximize).toHaveBeenCalledOnce();
  });

  it("plein écran antérieur à la lecture : il appartient à l'utilisateur", () => {
    const win = window();
    h.fullscreen = true; // DÉJÀ plein écran avant le film
    openPlayerSession(win as unknown as BrowserWindow);
    closePlayerSession(win as unknown as BrowserWindow);
    expect(h.leave).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("fenêtrée à la sortie : rien", () => {
    const win = window();
    openPlayerSession(win as unknown as BrowserWindow);
    closePlayerSession(win as unknown as BrowserWindow);
    expect(h.leave).not.toHaveBeenCalled();
  });

  it("montage imposé : la surface possède la restauration, pas nous", () => {
    const win = window();
    h.windowing = "plein-ecran";
    openPlayerSession(win as unknown as BrowserWindow);
    h.fullscreen = true;
    closePlayerSession(win as unknown as BrowserWindow);
    expect(h.leave).not.toHaveBeenCalled();
  });

  it("fenêtre détruite entre-temps : le maximize ne part pas", () => {
    const win = window();
    openPlayerSession(win as unknown as BrowserWindow);
    h.fullscreen = true;
    closePlayerSession(win as unknown as BrowserWindow);
    win.destroyed = true;
    win.emit("leave-full-screen");
    expect(win.maximize).not.toHaveBeenCalled();
  });
});
