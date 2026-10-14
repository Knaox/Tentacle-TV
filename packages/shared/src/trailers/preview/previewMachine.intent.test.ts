import { describe, expect, it } from "vitest";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  trailerPreviewWantsStream,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "./previewMachine";
import { TRAILER_PREVIEW_TIMING as T } from "./previewTiming";

/**
 * L'INTENTION de l'aperçu — ne rien demander au serveur (donc rien à YouTube)
 * tant que le pointeur n'est pas ARRÊTÉ sur une carte : un balayage de rangée,
 * même lent, ou un défilement à la molette ne coûtent aucune requête.
 */
type Step = TrailerPreviewEvent | { type: "wait"; until: number };

function run(steps: Step[], from: TrailerPreviewState = INITIAL_TRAILER_PREVIEW_STATE): TrailerPreviewState {
  let state = from;
  for (const step of steps) {
    if (step.type !== "wait") {
      state = reduceTrailerPreview(state, step);
      continue;
    }
    for (let deadline = nextTrailerPreviewDeadline(state); deadline !== null && deadline <= step.until; deadline = nextTrailerPreviewDeadline(state)) {
      state = reduceTrailerPreview(state, { type: "tick", at: deadline });
    }
  }
  return state;
}

/** Un pointeur qui bouge toutes les `everyMs` sur la carte, de `from` à `to`. */
function moving(from: number, to: number, everyMs: number): Step[] {
  const steps: Step[] = [];
  for (let at = from; at <= to; at += everyMs) steps.push({ type: "wait", until: at }, { type: "move", at });
  return steps;
}

describe("aperçu au survol : l'intention attend un pointeur arrêté", () => {
  it("un pointeur arrêté dès l'entrée : la demande part à l'intention, comme avant", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: T.intentMs }]);
    expect(state.phase).toBe("fetching");
  });

  it("un pointeur qui ne cesse de bouger sur la carte ne demande RIEN, même au bout de trois secondes", () => {
    const state = run([{ type: "hover", at: 0 }, ...moving(10, 3_000, 50)]);
    expect(state.phase).toBe("intent");
    expect(trailerPreviewWantsStream(state)).toBe(false);
  });

  it("il s'arrête après avoir bougé : la demande part `intentStillMs` après son dernier mouvement", () => {
    const steps: Step[] = [{ type: "hover", at: 0 }, ...moving(10, 600, 40)];
    const lastMove = 570;
    expect(run([...steps, { type: "wait", until: lastMove + T.intentStillMs - 1 }]).phase).toBe("intent");
    expect(run([...steps, { type: "wait", until: lastMove + T.intentStillMs }]).phase).toBe("fetching");
  });

  it("arrêté tôt mais entré il y a peu : la demande attend tout de même `intentMs` de survol", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "move", at: 20 }, { type: "wait", until: T.intentMs - 1 }]);
    expect(state.phase).toBe("intent");
    expect(run([{ type: "hover", at: 0 }, { type: "move", at: 20 }, { type: "wait", until: T.intentMs }]).phase).toBe("fetching");
  });

  it("un balayage de vingt cartes (un mouvement par image, sans arrêt) : aucune demande", () => {
    // 20 cartes de 180 px traversées à 0,5 px/ms : 360 ms sur chacune, bien plus que `intentMs`.
    for (let card = 0; card < 20; card++) {
      const state = run([{ type: "hover", at: 0 }, ...moving(16, 360, 16), { type: "unhover", at: 361 }, { type: "wait", until: 2_000 }]);
      expect(trailerPreviewWantsStream(state)).toBe(false);
      expect(state.phase).toBe("idle");
    }
  });

  it("une fois la demande partie, bouger ne la reprend pas", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: T.intentMs }, { type: "move", at: T.intentMs + 10 }]);
    expect(state.phase).toBe("fetching");
    expect(nextTrailerPreviewDeadline(state)).toBeNull();
  });

  it("la révélation part toujours du DÉBUT du survol, pas de l'arrêt du pointeur", () => {
    const state = run([
      { type: "hover", at: 0 },
      ...moving(10, 300, 30),
      { type: "wait", until: 400 },
      { type: "streamFound", at: 410 },
      { type: "videoReady", at: 600 },
      { type: "wait", until: T.revealMs },
    ]);
    expect(state.phase).toBe("shown");
  });
});
