import { describe, expect, it } from "vitest";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  trailerPreviewMounted,
  trailerPreviewVideoReady,
  trailerPreviewVisible,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "./previewMachine";
import { TRAILER_PREVIEW_TIMING as T } from "./previewTiming";

/**
 * La RÉVÉLATION SUR L'IMAGE : le serveur a vérifié la bande-annonce (flux
 * trouvé), son premier fragment vidéo est arrivé (le flux coule) et la
 * mini-carte a l'image du titre — elle se montre au rendez-vous sans attendre
 * la première image, que la vidéo apporte ensuite en fondu. Sans image : comme
 * avant. Un flux bloqué avant son premier fragment, ou sans bande-annonce :
 * rien, jamais.
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

/** Survol à 0, flux trouvé à `found`. */
const found = (at: number): Step[] => [{ type: "hover", at: 0 }, { type: "wait", until: at }, { type: "streamFound", at }];
/** …et son premier fragment vidéo reçu `afterMs` plus tard : le flux coule. */
const flowing = (at: number, afterMs = 100): Step[] => [...found(at), { type: "videoFragment", at: at + afterMs }];

describe("aperçu au survol : révélation sur l'image du titre", () => {
  it("flux qui coule et image prêts avant le rendez-vous : montrée au rendez-vous PILE, la vidéo pas encore là", () => {
    const steps = [...flowing(400), { type: "stillReady", at: 550 } as Step];
    expect(trailerPreviewVisible(run([...steps, { type: "wait", until: T.revealMs - 1 }]))).toBe(false);
    const state = run([...steps, { type: "wait", until: T.revealMs }]);
    expect(state.phase).toBe("shown");
    expect(trailerPreviewVideoReady(state)).toBe(false);
    // La vidéo la rejoint : toujours montrée, prête cette fois.
    const joined = reduceTrailerPreview(state, { type: "videoReady", at: 1_100 });
    expect([joined.phase, trailerPreviewVideoReady(joined), joined.readyBy]).toEqual(["shown", true, null]);
  });

  it("flux trouvé à froid, après le rendez-vous : montrée dès le premier fragment ET l'image, dans un ordre ou l'autre", () => {
    const imageFirst = run([...found(1_500), { type: "stillReady", at: 1_530 }]);
    expect(imageFirst.phase).toBe("buffering");
    const shown = reduceTrailerPreview(imageFirst, { type: "videoFragment", at: 1_700 });
    expect([shown.phase, trailerPreviewVideoReady(shown)]).toEqual(["shown", false]);
    expect(run([...flowing(1_500, 200), { type: "stillReady", at: 1_750 }]).phase).toBe("shown");
  });

  it("un flux BLOQUÉ avant son premier fragment (en-têtes puis rien) : jamais montré, même avec l'image ; échec au délai, sans rien à effacer", () => {
    const stalled = run([...found(500), { type: "stillReady", at: 520 }, { type: "wait", until: 500 + T.readyTimeoutMs - 1 }]);
    expect([stalled.phase, trailerPreviewVisible(stalled)]).toEqual(["buffering", false]);
    const failed = run([{ type: "wait", until: 500 + T.readyTimeoutMs }], stalled);
    expect([failed.phase, failed.failure, failed.exitUntil]).toEqual(["failed", "video", null]);
  });

  it("sans image du titre : comme avant, la première image décide", () => {
    const waiting = run([...found(500), { type: "wait", until: 2_000 }]);
    expect(waiting.phase).toBe("buffering");
    expect(run([...found(500), { type: "videoReady", at: 900 }]).phase).toBe("shown");
  });

  it("une image prête sans bande-annonce vérifiée ne montre RIEN", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: T.intentMs }, { type: "stillReady", at: 300 }, { type: "wait", until: 2_000 }]);
    expect(state.phase).toBe("fetching");
    expect(run([], reduceTrailerPreview(state, { type: "streamMissing", at: 2_100 })).phase).toBe("failed");
  });

  it("montrée sur l'image, la vidéo cale ensuite : échec au délai de la première image, fondu de sortie", () => {
    const shown = run([...flowing(500), { type: "stillReady", at: 520 }, { type: "wait", until: T.revealMs }]);
    expect(shown.phase).toBe("shown");
    expect(nextTrailerPreviewDeadline(shown)).toBe(500 + T.readyTimeoutMs);
    const failed = run([{ type: "wait", until: 500 + T.readyTimeoutMs }], shown);
    expect([failed.phase, failed.failure, trailerPreviewVisible(failed)]).toEqual(["failed", "video", false]);
    expect(trailerPreviewMounted(failed)).toBe(true);
    expect(failed.exitUntil).toBe(500 + T.readyTimeoutMs + T.exitMs);
  });

  it("retour pendant le fondu : la vidéo a de nouveau son délai ; sa première image arrivée PENDANT le fondu est retenue", () => {
    const shown = run([...flowing(500), { type: "stillReady", at: 620 }, { type: "wait", until: T.revealMs }]);
    const left = reduceTrailerPreview(shown, { type: "unhover", at: 900 });
    const back = reduceTrailerPreview(left, { type: "hover", at: 1_000 });
    expect([back.phase, back.readyBy]).toEqual(["shown", 1_000 + T.readyTimeoutMs]);
    const readyDuringExit = reduceTrailerPreview(left, { type: "videoReady", at: 950 });
    const backReady = reduceTrailerPreview(readyDuringExit, { type: "hover", at: 1_000 });
    expect([backReady.phase, trailerPreviewVideoReady(backReady), backReady.readyBy]).toEqual(["shown", true, null]);
  });

  it("un nouveau cycle repart sans image ni vidéo", () => {
    const shown = run([...flowing(500), { type: "stillReady", at: 620 }, { type: "videoReady", at: 700 }, { type: "wait", until: T.revealMs }]);
    const next = run([{ type: "unhover", at: 1_000 }, { type: "wait", until: 2_000 }, { type: "hover", at: 2_100 }], shown);
    expect([next.phase, next.stillReady, next.videoFragment, next.videoReady]).toEqual(["intent", false, false, false]);
  });
});
