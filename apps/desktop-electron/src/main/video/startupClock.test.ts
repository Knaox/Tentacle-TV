/**
 * L'horloge du démarrage : ce qui se garde, c'est la LIGNE — c'est elle qu'un
 * utilisateur colle dans un ticket, et c'est sur elle que le banc Linux du
 * 17.09 a mesuré ce que le lecteur payait avant le `loadfile`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  beginShutdown,
  beginStartup,
  describeStartup,
  endShutdown,
  forgetStartup,
  markStartup,
  sinceStartupMs,
} from "./startupClock";

beforeEach(() => forgetStartup());

describe("l'horloge du démarrage", () => {
  it("date chaque jalon depuis mpv_init et rend la ligne à la première image", () => {
    beginStartup(1000);
    expect(markStartup("init", 1009)).toBeNull();
    expect(markStartup("attach", 1021)).toBeNull();
    expect(markStartup("loadfile", 1034)).toBeNull();
    expect(markStartup("file-loaded", 1410)).toBeNull();
    expect(markStartup("video-reconfig", 1780)).toBeNull();
    expect(markStartup("playback-restart", 1830)).toBe(
      "[mpv] démarrage — init 9 ms · attache 12 ms · loadfile à +34 ms · ouverture 376 ms" +
        " · sortie vidéo 370 ms · première image à +830 ms (796 ms après loadfile)",
    );
    expect(sinceStartupMs(1900)).toBe(900);
  });

  it("ne date rien hors démarrage, et un jalon ne se rejoue pas", () => {
    expect(markStartup("init", 5)).toBeNull();
    expect(sinceStartupMs(5)).toBeNull();
    beginStartup(0);
    markStartup("loadfile", 0);
    markStartup("file-loaded", 100);
    // Un second file-loaded ne déplace pas le premier ; un playback-restart de
    // seek n'est pas une première image.
    markStartup("file-loaded", 900);
    expect(markStartup("playback-restart", 200)).toContain("ouverture 100 ms");
    expect(markStartup("playback-restart", 5000)).toBeNull();
  });

  it("un loadfile de plus rouvre les jalons de chargement, pas ceux de l'init", () => {
    beginStartup(0);
    markStartup("init", 10);
    markStartup("loadfile", 20);
    markStartup("file-loaded", 200);
    markStartup("playback-restart", 300);
    markStartup("loadfile", 1000);
    markStartup("file-loaded", 1100);
    expect(markStartup("playback-restart", 1250)).toBe(
      "[mpv] démarrage — init 10 ms · loadfile à +1000 ms · ouverture 100 ms" +
        " · première image à +1250 ms (250 ms après loadfile)",
    );
  });

  it("le changement d'épisode se compte depuis mpv_destroy : arrêt, relance de la page, init", () => {
    beginShutdown(0);
    endShutdown(520);
    beginStartup(700);
    markStartup("init", 710);
    markStartup("attach", 725);
    expect(markStartup("playback-restart", 900)).toContain(
      "arrêt du précédent 520 ms · relance de la page 180 ms · init 10 ms · attache 15 ms · première image à +900 ms",
    );
  });

  it("une instance gardée au chaud se dit, et un arrêt trop ancien ne compte plus", () => {
    beginShutdown(0);
    endShutdown(1);
    beginStartup(150);
    markStartup("reused", 152);
    expect(markStartup("playback-restart", 400)).toBe(
      "[mpv] démarrage — arrêt du précédent 1 ms · relance de la page 149 ms · instance gardée au chaud 2 ms · première image à +400 ms",
    );

    beginShutdown(0);
    endShutdown(100);
    beginStartup(50_000);
    expect(markStartup("playback-restart", 50_300)).toBe("[mpv] démarrage — première image à +300 ms");
  });

  it("la ligne reste lisible avec des jalons manquants", () => {
    expect(describeStartup(new Map([["playback-restart", 830]]))).toBe(
      "[mpv] démarrage — première image à +830 ms",
    );
  });
});
