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
import {
  arrivesFromPlugin,
  captureDetailOrigin,
  consumeDetailOrigin,
  markPluginNavigation,
  OPENING_LANDED_GUARD_MS,
  openingStep,
} from "./detailTransition";

/** Doit rester égal à `MAX_AGE_MS` du module. */
const WINDOW_MS = 1200;

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
    vi.advanceTimersByTime(WINDOW_MS);
    expect(arrivesFromPlugin()).toBe(true);
  });

  it("se périme au-delà — la fiche suivante s'ouvre normalement", () => {
    markPluginNavigation();
    vi.advanceTimersByTime(WINDOW_MS + 1);
    expect(arrivesFromPlugin()).toBe(false);
  });
});

/**
 * Le calque d'ouverture d'une fiche dont le titre n'a AUCUNE image (Jellyfin
 * n'a rien trouvé) : il attendait une affiche à viser qui ne venait jamais et
 * couvrait la page pour toujours — écran vide, ni « Lecture » ni épisodes.
 */
describe("calque d'ouverture d'un titre sans image", () => {
  const visual = { getBoundingClientRect: () => ({ top: 10, left: 20, width: 200, height: 300 }) } as unknown as HTMLElement;

  it("une carte sans image ne pose aucune origine : rien à faire voler", () => {
    captureDetailOrigin(visual, "serie", "");
    expect(consumeDetailOrigin("serie")).toBeNull();
    captureDetailOrigin(visual, "serie", "/affiche.jpg");
    expect(consumeDetailOrigin("serie")?.imageUrl).toBe("/affiche.jpg");
  });

  it("tant que la fiche se prépare, rien ne vole : la carte reste en place", () => {
    expect(openingStep({ revealed: false, hasTarget: false, reduced: false })).toBe("wait");
    // La fiche est en page (son affiche est mesurée) mais pas encore montrée : on attend encore.
    expect(openingStep({ revealed: false, hasTarget: true, reduced: false })).toBe("wait");
  });

  it("la fiche se montre et son affiche a une place : le visuel décolle avec elle", () => {
    expect(openingStep({ revealed: true, hasTarget: true, reduced: false })).toBe("fly");
  });

  it("la fiche montrée SANS visuel à viser : rien à jouer, le calque se retire", () => {
    expect(openingStep({ revealed: true, hasTarget: false, reduced: false })).toBe("skip");
  });

  it("animations réduites : rien ne vole, jamais", () => {
    expect(openingStep({ revealed: false, hasTarget: false, reduced: true })).toBe("skip");
    expect(openingStep({ revealed: true, hasTarget: true, reduced: true })).toBe("skip");
    expect(OPENING_LANDED_GUARD_MS).toBeGreaterThan(320);
  });
});
