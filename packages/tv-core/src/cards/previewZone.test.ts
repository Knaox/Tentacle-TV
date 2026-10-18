import { describe, expect, it } from "vitest";
import {
  INITIAL_PREVIEW_ZONE as START,
  PREVIEW_ZONE_DETAILS_MS,
  previewZoneBackdropLayer,
  previewZoneDetailsLeft,
  previewZoneShown,
  reducePreviewZone as reduce,
  type PreviewZoneEvent,
} from "./previewZone";

const run = (...events: PreviewZoneEvent[]) => events.reduce(reduce, START);

describe("reducePreviewZone — la zone suit le focus, aussitôt", () => {
  it("la carte focalisée devient le sujet au focus même, datée", () => {
    expect(run({ type: "focusCard", id: "a", at: 10 })).toEqual({ subject: { kind: "card", id: "a" }, focused: true, since: 10 });
  });

  it("le focus parti ailleurs qu'une carte, la zone garde la dernière carte (sans focus)", () => {
    expect(run({ type: "focusCard", id: "a", at: 10 }, { type: "blurCard", id: "a", at: 20 })).toEqual({
      subject: { kind: "card", id: "a" }, focused: false, since: null,
    });
  });

  it("le flou de la précédente, arrivé après le focus de la suivante, ne touche à rien", () => {
    const state = run({ type: "focusCard", id: "a", at: 10 }, { type: "focusCard", id: "b", at: 12 }, { type: "blurCard", id: "a", at: 13 });
    expect(state).toEqual({ subject: { kind: "card", id: "b" }, focused: true, since: 12 });
  });

  it("le même focus redit ne repart pas de zéro", () => {
    const state = run({ type: "focusCard", id: "a", at: 10 }, { type: "focusCard", id: "a", at: 50 });
    expect(state.since).toBe(10);
  });

  it("revenir sur une carte après l'avoir quittée repart de son nouveau focus", () => {
    const state = run({ type: "focusCard", id: "a", at: 10 }, { type: "blurCard", id: "a", at: 20 }, { type: "focusCard", id: "a", at: 30 });
    expect(state.since).toBe(30);
  });

  it("le héros est un sujet comme une carte", () => {
    const state = run({ type: "focusCard", id: "a", at: 10 }, { type: "focusHero", at: 15 }, { type: "blurCard", id: "a", at: 16 });
    expect(state).toEqual({ subject: { kind: "hero" }, focused: true, since: 15 });
    expect(reduce(state, { type: "blurHero", at: 20 }).focused).toBe(false);
  });
});

describe("previewZoneShown — jamais vide sous les yeux", () => {
  it("avant tout focus : le héros, sinon le repli de la page, sinon rien", () => {
    expect(previewZoneShown(START, { hasHero: true, fallbackId: "f" })).toEqual({ kind: "hero" });
    expect(previewZoneShown(START, { hasHero: false, fallbackId: "f" })).toEqual({ kind: "card", id: "f" });
    expect(previewZoneShown(START, { hasHero: false, fallbackId: null })).toBeNull();
  });

  it("après un focus : le dernier sujet, même sans focus", () => {
    const state = run({ type: "focusCard", id: "a", at: 1 }, { type: "blurCard", id: "a", at: 2 });
    expect(previewZoneShown(state, { hasHero: true, fallbackId: "f" })).toEqual({ kind: "card", id: "a" });
  });

  it("un héros disparu (plus de titre mis en avant) laisse place au repli", () => {
    const state = run({ type: "focusHero", at: 1 });
    expect(previewZoneShown(state, { hasHero: false, fallbackId: "f" })).toEqual({ kind: "card", id: "f" });
  });
});

describe("previewZoneDetailsLeft — les détails quand le focus a tenu", () => {
  it("le reste du délai, puis 0", () => {
    expect(previewZoneDetailsLeft(100, 100)).toBe(PREVIEW_ZONE_DETAILS_MS);
    expect(previewZoneDetailsLeft(100, 100 + PREVIEW_ZONE_DETAILS_MS + 50)).toBe(0);
  });
});

describe("previewZoneBackdropLayer — le fondu croisé du fond", () => {
  it("l'image neuve va sur le calque de derrière ; déjà devant, rien", () => {
    expect(previewZoneBackdropLayer({ front: 0, uris: ["a", null] }, "b")).toBe(1);
    expect(previewZoneBackdropLayer({ front: 1, uris: ["a", "b"] }, "c")).toBe(0);
    expect(previewZoneBackdropLayer({ front: 1, uris: ["a", "b"] }, "b")).toBeNull();
  });
});
