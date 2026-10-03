import { describe, expect, it } from "vitest";
import {
  CLOSE_AFTER_SUBMIT_MS,
  KEYBOARD_GONE_MS,
  SEARCH_SUBMIT_IDLE,
  searchSubmitStep,
  type SearchSubmitEvent,
  type SearchSubmitFlowState,
} from "./searchSubmitFlow";
import { SEARCH_SUBMIT_WAIT_MS } from "./searchSubmit";

/** Rejoue des évènements depuis le repos ; rend l'état final et les effets, pas à pas. */
function play(events: SearchSubmitEvent[], from: SearchSubmitFlowState = SEARCH_SUBMIT_IDLE) {
  let state = from;
  const effects: string[][] = [];
  for (const event of events) {
    const step = searchSubmitStep(state, event);
    state = step.state;
    effects.push(step.effects.map((effect) => (effect.type === "armGoneTimer" ? `armGoneTimer:${effect.ms}` : effect.type)));
  }
  return { state, effects };
}

describe("validation au clavier système", () => {
  it("mène au premier résultat une fois le clavier parti, la réponse déjà là", () => {
    const { state, effects } = play([
      { type: "submit", at: 0 },
      { type: "closed", at: 100 },
      { type: "gone", at: 300, answer: "results" },
    ]);
    expect(effects).toEqual([[], [`armGoneTimer:${KEYBOARD_GONE_MS}`], ["cancelGoneTimer", "focusFirstResult"]]);
    expect(state.pending).toBeNull();
  });

  it("attend que le clavier soit parti : la réponse seule n'emmène pas le focus", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "answer", at: 50, answer: "results" },
    ]);
    expect(effects).toEqual([[], []]);
  });

  it("la réponse en attente y mène encore si elle arrive dans le délai", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "pending" },
      { type: "answer", at: 1500, answer: "results" },
    ]);
    expect(effects).toEqual([[], ["cancelGoneTimer"], ["focusFirstResult"]]);
  });

  it("une réponse arrivée trop tard n'emmène plus le focus", () => {
    const { state, effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "pending" },
      { type: "answer", at: SEARCH_SUBMIT_WAIT_MS + 1, answer: "results" },
    ]);
    expect(effects[2]).toEqual([]);
    expect(state.pending).toBeNull();
  });

  it("la borne du délai est incluse : à 3 s pile, elle y mène encore", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "pending" },
      { type: "answer", at: SEARCH_SUBMIT_WAIT_MS, answer: "results" },
    ]);
    expect(effects[2]).toEqual(["focusFirstResult"]);
  });

  it("rien à atteindre : la validation se clôt sans bouger le focus", () => {
    const { state, effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "none" },
    ]);
    expect(effects[1]).toEqual(["cancelGoneTimer"]);
    expect(state.pending).toBeNull();
  });

  it("une touche pressée après le départ du clavier : l'utilisateur a pris la main", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "pending" },
      { type: "press" },
      { type: "answer", at: 900, answer: "results" },
    ]);
    expect(effects[3]).toEqual([]);
  });

  it("une touche pressée AVANT le départ du clavier n'annule rien", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "press" },
      { type: "gone", at: 300, answer: "results" },
    ]);
    expect(effects[2]).toEqual(["cancelGoneTimer", "focusFirstResult"]);
  });

  it("le clavier parti deux fois ne compte qu'une fois", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "gone", at: 200, answer: "pending" },
      { type: "gone", at: 400, answer: "results" },
    ]);
    expect(effects[2]).toEqual([]);
  });

  it("« parti » sans validation en cours ne fait rien — pas même annuler le filet", () => {
    expect(play([{ type: "gone", at: 10, answer: "results" }]).effects).toEqual([[]]);
  });

  it("chaque annonce de fermeture réarme le filet tant que le clavier n'est pas parti", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "closed", at: 100 },
      { type: "closed", at: 200 },
      { type: "gone", at: 900, answer: "none" },
      { type: "closed", at: 950 },
    ]);
    expect(effects.slice(1)).toEqual([
      [`armGoneTimer:${KEYBOARD_GONE_MS}`],
      [`armGoneTimer:${KEYBOARD_GONE_MS}`],
      ["cancelGoneTimer"],
      [],
    ]);
  });

  it("une nouvelle validation n'annule pas le filet de la précédente", () => {
    const { effects } = play([
      { type: "submit", at: 0 },
      { type: "closed", at: 100 },
      { type: "submit", at: 300 },
    ]);
    expect(effects[2]).toEqual([]);
  });
});

describe("fermeture du clavier sans validation (Menu)", () => {
  it("rend le focus au clavier à l'écran", () => {
    expect(play([{ type: "closed", at: 5000 }]).effects).toEqual([["keyboardClosedWithoutSubmit"]]);
  });

  it("une fermeture qui suit une validation de près en est la suite", () => {
    const { effects } = play([
      { type: "submit", at: 1000 },
      { type: "gone", at: 1100, answer: "results" },
      { type: "closed", at: 1000 + CLOSE_AFTER_SUBMIT_MS },
      { type: "closed", at: 1000 + CLOSE_AFTER_SUBMIT_MS + 1 },
    ]);
    expect(effects[2]).toEqual([]);
    expect(effects[3]).toEqual(["keyboardClosedWithoutSubmit"]);
  });
});
