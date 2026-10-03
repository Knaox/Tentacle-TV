import { describe, expect, it } from "vitest";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import { createTranslator } from "../remote/translate";
import type { SignalPhase } from "../remote/signals";
import {
  BEYOND_EDGE_SETTLE_MS,
  NO_FOCUS_ARRIVAL,
  arrivalAfterFocus,
  isBeyondEdge,
  isGestureToward,
  type BeyondEdgeTraits,
} from "./beyondEdge";

const tvos = createTranslator(TVOS_BINDINGS);
const TVOS: BeyondEdgeTraits = TVOS_BINDINGS.traits;

/** Ce que la Siri Remote livre, traduit par la table tvOS. */
function tvosEvent(name: string, at: number, phase: SignalPhase | null = "up") {
  const event = tvos.translate({ name, phase, at });
  if (!event) throw new Error(`signal sans intention : ${name}`);
  return event;
}

describe("isGestureToward — un geste vers un côté", () => {
  it("un appui de la flèche (annoncé au relâchement) et un glisser rapide", () => {
    expect(isGestureToward(tvosEvent("right", 0), "droite", TVOS)).toBe(true);
    expect(isGestureToward(tvosEvent("swipeRight", 0, null), "droite", TVOS)).toBe(true);
    expect(isGestureToward(tvosEvent("right", 0, null), "droite", TVOS)).toBe(true);
  });

  it("pas l'enfoncement d'un appui annoncé au relâchement : il ne compte qu'une fois", () => {
    expect(isGestureToward(tvosEvent("right", 0, "down"), "droite", TVOS)).toBe(false);
    expect(isGestureToward(tvosEvent("right", 0, "down"), "droite", { ...TVOS, pressOnRelease: false })).toBe(true);
  });

  it("ni un maintien, ni une autre direction, ni un autre geste", () => {
    expect(isGestureToward(tvosEvent("longRight", 0, "down"), "droite", TVOS)).toBe(false);
    expect(isGestureToward(tvosEvent("longRight", 0, "up"), "droite", TVOS)).toBe(false);
    expect(isGestureToward(tvosEvent("left", 0), "droite", TVOS)).toBe(false);
    expect(isGestureToward(tvosEvent("swipeUp", 0, null), "droite", TVOS)).toBe(false);
    expect(isGestureToward(tvosEvent("select", 0), "droite", TVOS)).toBe(false);
  });
});

describe("isBeyondEdge — au-delà du bord", () => {
  const edge = { edgeKey: "hero:list", direction: "droite" as const, traits: TVOS };
  const settled = arrivalAfterFocus(NO_FOCUS_ARRIVAL, "hero:list", true, 1_000);

  it("le focus au bord depuis 400 ms au moins : le geste va au-delà", () => {
    expect(BEYOND_EDGE_SETTLE_MS).toBe(400);
    expect(isBeyondEdge(tvosEvent("right", 1_400), { ...edge, focusedKey: "hero:list", arrival: settled })).toBe(true);
    expect(isBeyondEdge(tvosEvent("swipeRight", 5_000, null), { ...edge, focusedKey: "hero:list", arrival: settled })).toBe(true);
  });

  it("le geste qui vient d'AMENER le focus au bord ne compte pas (tvOS : ~60 ms après)", () => {
    expect(isBeyondEdge(tvosEvent("right", 1_060), { ...edge, focusedKey: "hero:list", arrival: settled })).toBe(false);
    expect(isBeyondEdge(tvosEvent("right", 1_399), { ...edge, focusedKey: "hero:list", arrival: settled })).toBe(false);
  });

  it("une plateforme qui déplace le focus APRÈS l'intention n'attend pas", () => {
    const traits = { ...TVOS, focusMovesBeforeIntent: false };
    expect(isBeyondEdge(tvosEvent("right", 1_060), { ...edge, traits, focusedKey: "hero:list", arrival: settled })).toBe(true);
  });

  it("le focus ailleurs, ou pas de bord : rien", () => {
    expect(isBeyondEdge(tvosEvent("right", 9_000), { ...edge, focusedKey: "hero:secondary", arrival: settled })).toBe(false);
    expect(isBeyondEdge(tvosEvent("right", 9_000), { ...edge, edgeKey: null, focusedKey: "hero:list", arrival: settled })).toBe(false);
  });

  it("une arrivée sur une AUTRE clé ne retient pas le geste", () => {
    const elsewhere = arrivalAfterFocus(settled, "hero:secondary", true, 2_000);
    expect(isBeyondEdge(tvosEvent("right", 2_010), { ...edge, focusedKey: "hero:list", arrival: elsewhere })).toBe(true);
  });

  it("une perte de focus ne change pas l'arrivée", () => {
    expect(arrivalAfterFocus(settled, "hero:list", false, 3_000)).toBe(settled);
  });
});
