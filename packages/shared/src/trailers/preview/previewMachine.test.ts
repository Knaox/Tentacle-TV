import { describe, expect, it } from "vitest";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  trailerPreviewMounted,
  trailerPreviewPlaying,
  trailerPreviewVisible,
  trailerPreviewWantsStream,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "./previewMachine";
import { TRAILER_PREVIEW_TIMING as T } from "./previewTiming";

/**
 * La machine de l'aperçu, rejouée sur une horloge factice : chaque évènement
 * porte son instant, et `run` fait aussi passer les échéances que la minuterie
 * du crochet rendrait (`nextTrailerPreviewDeadline` → `tick`).
 */
type Step = TrailerPreviewEvent | { type: "wait"; until: number };

function run(steps: Step[], from: TrailerPreviewState = INITIAL_TRAILER_PREVIEW_STATE): TrailerPreviewState {
  let state = from;
  for (const step of steps) {
    if (step.type === "wait") {
      // La minuterie : chaque échéance atteinte avant `until` rend un `tick` à son instant.
      for (let deadline = nextTrailerPreviewDeadline(state); deadline !== null && deadline <= step.until; deadline = nextTrailerPreviewDeadline(state)) {
        state = reduceTrailerPreview(state, { type: "tick", at: deadline });
      }
      continue;
    }
    state = reduceTrailerPreview(state, step);
  }
  return state;
}

/** Survol à 0, flux trouvé à `found`, première image à `ready`. */
function shownAt(found = 500, ready = 700): TrailerPreviewState {
  return run([
    { type: "hover", at: 0 },
    { type: "wait", until: found },
    { type: "streamFound", at: found },
    { type: "videoReady", at: ready },
    { type: "wait", until: Math.max(ready, T.revealMs) },
  ]);
}

describe("aperçu au survol : le chemin heureux", () => {
  it("rien avant l'intention : un passage de souris ne demande rien", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: T.intentMs - 1 }]);
    expect(state.phase).toBe("intent");
    expect(trailerPreviewWantsStream(state)).toBe(false);
    expect(run([{ type: "hover", at: 0 }, { type: "unhover", at: 200 }, { type: "wait", until: 5_000 }]).phase).toBe("idle");
  });

  it("la demande part à l'intention", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: T.intentMs }]);
    expect(state.phase).toBe("fetching");
    expect(trailerPreviewWantsStream(state)).toBe(true);
  });

  it("chargée cachée, prête, puis montrée à la seconde — jamais avant", () => {
    let state = run([{ type: "hover", at: 0 }, { type: "wait", until: 400 }, { type: "streamFound", at: 400 }]);
    expect(state.phase).toBe("buffering");
    expect(trailerPreviewMounted(state)).toBe(true);
    expect(trailerPreviewVisible(state)).toBe(false);

    state = reduceTrailerPreview(state, { type: "videoReady", at: 600 });
    expect(state.phase).toBe("ready");
    expect(trailerPreviewVisible(state)).toBe(false);
    expect(nextTrailerPreviewDeadline(state)).toBe(T.revealMs);

    state = run([{ type: "wait", until: T.revealMs - 1 }], state);
    expect(state.phase).toBe("ready");
    state = run([{ type: "wait", until: T.revealMs }], state);
    expect(state.phase).toBe("shown");
    expect(trailerPreviewVisible(state)).toBe(true);
    expect(trailerPreviewPlaying(state)).toBe(true);
  });

  it("une première image venue après la seconde se montre aussitôt", () => {
    const state = run([
      { type: "hover", at: 0 },
      { type: "wait", until: 400 },
      { type: "streamFound", at: 1_500 },
      { type: "videoReady", at: 2_100 },
    ]);
    expect(state.phase).toBe("shown");
  });

  it("la fin de la bande-annonce : la mini-carte s'efface, la vidéo reste le temps du fondu", () => {
    let state = reduceTrailerPreview(shownAt(), { type: "videoEnded", at: 30_000 });
    expect(state.phase).toBe("ended");
    expect(trailerPreviewVisible(state)).toBe(false);
    expect(trailerPreviewMounted(state)).toBe(true);
    expect(trailerPreviewPlaying(state)).toBe(true);
    state = run([{ type: "wait", until: 30_000 + T.exitMs }], state);
    expect(trailerPreviewMounted(state)).toBe(false);
    // Toujours survolée : rien ne se rejoue.
    expect(state.phase).toBe("ended");
    expect(run([{ type: "wait", until: 60_000 }], state).phase).toBe("ended");
  });
});

describe("aperçu au survol : rien ne s'anime sans bande-annonce lisible", () => {
  it("un refus du serveur : échec, aucune vidéo", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: 400 }, { type: "streamMissing", at: 450 }]);
    expect(state).toMatchObject({ phase: "failed", failure: "missing" });
    expect(trailerPreviewMounted(state)).toBe(false);
  });

  it("une erreur avant la révélation : rien n'a été montré, rien ne reste monté", () => {
    const state = run([
      { type: "hover", at: 0 },
      { type: "wait", until: 400 },
      { type: "streamFound", at: 400 },
      { type: "videoFailed", at: 700 },
    ]);
    expect(state).toMatchObject({ phase: "failed", failure: "video", exitUntil: null });
    expect(trailerPreviewMounted(state)).toBe(false);
  });

  it("une erreur après la révélation : la mini-carte s'efface en fondu", () => {
    const state = reduceTrailerPreview(shownAt(), { type: "videoFailed", at: 5_000 });
    expect(state).toMatchObject({ phase: "failed", failure: "video", exitUntil: 5_000 + T.exitMs, resumable: false });
    expect(trailerPreviewVisible(state)).toBe(false);
  });

  it("une première image qui n'arrive pas : échec au délai", () => {
    const state = run([
      { type: "hover", at: 0 },
      { type: "wait", until: 400 },
      { type: "streamFound", at: 400 },
      { type: "wait", until: 400 + T.readyTimeoutMs },
    ]);
    expect(state).toMatchObject({ phase: "failed", failure: "video" });
  });

  it("une vidéo finie avant d'être montrée n'avait rien à montrer", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "wait", until: 400 }, { type: "streamFound", at: 400 }, { type: "videoEnded", at: 500 }]);
    expect(state.phase).toBe("failed");
  });
});

describe("aperçu au survol : la sortie et le retour", () => {
  it("quitter avant la révélation coupe tout, sans fondu", () => {
    const state = run([
      { type: "hover", at: 0 },
      { type: "wait", until: 400 },
      { type: "streamFound", at: 400 },
      { type: "videoReady", at: 600 },
      { type: "unhover", at: 800 },
    ]);
    expect(state.phase).toBe("idle");
    expect(trailerPreviewMounted(state)).toBe(false);
    expect(nextTrailerPreviewDeadline(state)).toBeNull();
  });

  it("quitter une lecture montrée : fondu de sortie, puis plus rien", () => {
    let state = reduceTrailerPreview(shownAt(), { type: "unhover", at: 3_000 });
    expect(state).toMatchObject({ phase: "idle", exitUntil: 3_000 + T.exitMs, resumable: true });
    expect(trailerPreviewVisible(state)).toBe(false);
    expect(trailerPreviewMounted(state)).toBe(true);
    state = run([{ type: "wait", until: 3_000 + T.exitMs }], state);
    expect(trailerPreviewMounted(state)).toBe(false);
    expect(trailerPreviewPlaying(state)).toBe(false);
  });

  it("revenir pendant le fondu reprend la lecture, sans nouveau cycle", () => {
    const shown = shownAt();
    const state = run([{ type: "unhover", at: 3_000 }, { type: "hover", at: 3_100 }], shown);
    expect(state).toMatchObject({ phase: "shown", exitUntil: null, cycle: shown.cycle });
  });

  it("revenir après le fondu ouvre un cycle neuf", () => {
    const shown = shownAt();
    const state = run([{ type: "unhover", at: 3_000 }, { type: "wait", until: 4_000 }, { type: "hover", at: 4_000 }], shown);
    expect(state).toMatchObject({ phase: "intent", since: 4_000, cycle: shown.cycle + 1 });
  });

  it("revenir pendant le fondu d'une lecture FINIE ne la reprend pas", () => {
    const state = run([{ type: "videoEnded", at: 3_000 }, { type: "unhover", at: 3_050 }, { type: "hover", at: 3_100 }], shownAt());
    expect(state.phase).toBe("intent");
    expect(state.exitUntil).toBeNull();
  });
});

describe("aperçu au survol : blocages, arbitre, sujet", () => {
  it("bloqué : le survol est noté, rien ne démarre ; débloqué, l'aperçu part", () => {
    let state = run([{ type: "block", at: 0 }, { type: "hover", at: 10 }, { type: "wait", until: 5_000 }]);
    expect(state).toMatchObject({ phase: "idle", hovered: true, blocked: true });
    state = reduceTrailerPreview(state, { type: "unblock", at: 5_000 });
    expect(state).toMatchObject({ phase: "intent", since: 5_000 });
  });

  it("un blocage pendant la lecture l'arrête (fondu), sans reprise", () => {
    const state = reduceTrailerPreview(shownAt(), { type: "block", at: 2_000 });
    expect(state).toMatchObject({ phase: "idle", exitUntil: 2_000 + T.exitMs, resumable: false });
  });

  it("débloqué après une lecture finie : rien ne se rejoue sous le même survol", () => {
    const ended = reduceTrailerPreview(shownAt(), { type: "videoEnded", at: 20_000 });
    const state = run([{ type: "block", at: 21_000 }, { type: "unblock", at: 22_000 }], ended);
    expect(state.phase).toBe("ended");
  });

  it("évincé par un autre aperçu : terminé pour ce survol", () => {
    const fetching = run([{ type: "hover", at: 0 }, { type: "wait", until: 400 }]);
    expect(reduceTrailerPreview(fetching, { type: "preempted", at: 450 }).phase).toBe("ended");
    expect(reduceTrailerPreview(shownAt(), { type: "preempted", at: 2_000 })).toMatchObject({ phase: "ended", resumable: false });
  });

  it("un autre titre sous le même survol : cycle neuf, l'ancienne vidéo part sans fondu", () => {
    const shown = shownAt();
    const state = reduceTrailerPreview(shown, { type: "restart", at: 2_000 });
    expect(state).toMatchObject({ phase: "intent", since: 2_000, exitUntil: null, cycle: shown.cycle + 1 });
    const idle = reduceTrailerPreview(run([{ type: "hover", at: 0 }, { type: "unhover", at: 10 }]), { type: "restart", at: 20 });
    expect(idle.phase).toBe("idle");
  });

  it("les évènements hors de propos ne changent rien", () => {
    const idle = INITIAL_TRAILER_PREVIEW_STATE;
    for (const type of ["streamFound", "streamMissing", "videoReady", "videoFailed", "videoEnded", "preempted", "unhover", "unblock"] as const) {
      expect(reduceTrailerPreview(idle, { type, at: 1 })).toEqual(idle);
    }
  });
});
