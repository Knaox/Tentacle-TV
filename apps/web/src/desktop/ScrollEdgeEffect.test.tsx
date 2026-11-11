import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beginRouteHold, resetRouteHoldForTests } from "../components/routeTransition/routeHold";

/**
 * L'effet de bord qu'une page quittée emporte pendant qu'une navigation attend.
 *
 * Vu au banc (lot « rf2 », verre allumé) : la fenêtre est remise au défilement de la page
 * suivante dès le clic, la page quittée reste à l'écran — et le haut d'une page défilée
 * redevenait net sous la barre, le temps de l'attente.
 */

const glass = vi.hoisted(() => ({ on: true }));
vi.mock("./windowGlass", () => ({ useWindowGlass: () => glass.on }));

const { CarriedScrollEdge, scrollEdgeOpacity } = await import("./ScrollEdgeEffect");

const carried = (scrollY: number) => renderToStaticMarkup(createElement(CarriedScrollEdge, { scrollY }));

afterEach(() => {
  resetRouteHoldForTests();
  glass.on = true;
});

describe("scrollEdgeOpacity", () => {
  it("nul en haut de page, plein après 48 px, proportionnel entre les deux", () => {
    expect(scrollEdgeOpacity(0)).toBe(0);
    expect(scrollEdgeOpacity(24)).toBe(0.5);
    expect(scrollEdgeOpacity(48)).toBe(1);
    expect(scrollEdgeOpacity(3660)).toBe(1);
    expect(scrollEdgeOpacity(-12)).toBe(0);
  });
});

describe("CarriedScrollEdge — l'effet de bord d'une page épinglée", () => {
  it("paraît quand la navigation se met à attendre, à l'opacité qu'on lui voyait", () => {
    beginRouteHold();
    expect(carried(24)).toBe('<div aria-hidden="true" class="lgc-edge" style="opacity:0.5"></div>');
    expect(carried(900)).toContain("opacity:1");
  });

  it("tant que l'attente n'a pas commencé, l'effet de la fenêtre est encore là : rien en double", () => {
    expect(carried(900)).toBe("");
  });

  it("une page quittée en haut n'en emporte pas", () => {
    beginRouteHold();
    expect(carried(0)).toBe("");
  });

  it("hors du verre de fenêtre, rien — le rendu d'avant", () => {
    glass.on = false;
    beginRouteHold();
    expect(carried(900)).toBe("");
  });
});
