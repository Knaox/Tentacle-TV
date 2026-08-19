/**
 * Le marqueur de navigation venue d'un greffon est une DATE, pas un drapeau :
 * il se périme tout seul. C'est ce qui l'empêche de déteindre sur la fiche
 * suivante — celle qu'on ouvre depuis un « titre similaire », dix secondes
 * plus tard, et qui doit bel et bien jouer son ouverture.
 *
 * Ces trois cas tiennent la fenêtre en place : sans elle, une seule visite de
 * greffon suffirait à éteindre l'ouverture de toutes les fiches de la session,
 * et rien n'échouerait bruyamment pour le dire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arrivesFromPlugin, markPluginNavigation } from "./detailTransition";

/** Doit rester égal à `MAX_AGE_MS` du module. */
const FENETRE_MS = 1200;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("navigation demandée par un greffon", () => {
  it("ne prétend rien tant qu'aucun greffon n'a navigué", () => {
    expect(arrivesFromPlugin()).toBe(false);
  });

  it("est vraie juste après la demande", () => {
    markPluginNavigation();
    expect(arrivesFromPlugin()).toBe(true);
  });

  it("tient encore au bord de la fenêtre", () => {
    markPluginNavigation();
    vi.advanceTimersByTime(FENETRE_MS);
    expect(arrivesFromPlugin()).toBe(true);
  });

  it("se périme au-delà — la fiche suivante s'ouvre normalement", () => {
    markPluginNavigation();
    vi.advanceTimersByTime(FENETRE_MS + 1);
    expect(arrivesFromPlugin()).toBe(false);
  });
});
