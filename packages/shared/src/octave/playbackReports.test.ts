import { describe, expect, it } from "vitest";
import type { MusicPlaybackReport } from "../music";
import { libraryTrack } from "./fixtures";
import { PlaybackReporter } from "./playbackReports";

function harness(options: { withAppState?: boolean } = {}) {
  let now = 1_000;
  let background = false;
  const sent: MusicPlaybackReport[] = [];
  const reporter = new PlaybackReporter({
    library: (r) => sent.push(r),
    externalPlayed: () => undefined,
    now: () => now,
    ...(options.withAppState ? { background: () => background } : {}),
  });
  return {
    reporter,
    sent,
    events: () => sent.map((r) => r.event),
    advance: (ms: number) => (now += ms),
    setBackground: (on: boolean) => (background = on),
  };
}

/** Le moteur dit sa position toutes les `tickMs` pendant `forMs` : comme `onEngineState` en lecture. */
function play(h: ReturnType<typeof harness>, from: number, forMs: number, tickMs: number): number {
  let position = from;
  for (let elapsed = 0; elapsed < forMs; elapsed += tickMs) {
    h.advance(tickMs);
    position += tickMs;
    h.reporter.progress(position);
  }
  return position;
}

describe("rapport d'écoute à Jellyfin", () => {
  it("une progression toutes les 15 s, pas plus", () => {
    const { reporter, sent, advance } = harness();
    reporter.started(libraryTrack("a1"), 0);
    advance(5_000);
    reporter.progress(5_000);
    advance(11_000);
    reporter.progress(16_000);
    expect(sent.map((r) => r.event)).toEqual(["start", "progress"]);
  });

  it("la reprise après une pause se dit au premier son — le tableau de bord ne reste pas « en pause » 15 s", () => {
    const { reporter, sent, advance } = harness();
    reporter.started(libraryTrack("a1"), 0);
    advance(2_000);
    reporter.paused(2_000);
    advance(1_000);
    reporter.progress(2_000);
    expect(sent.map((r) => r.event)).toEqual(["start", "pause", "progress"]);
    // Puis le rythme normal reprend.
    advance(1_000);
    reporter.progress(3_000);
    expect(sent).toHaveLength(3);
  });
});

describe("app derrière (mobile) : la progression s'espace, le reste part tout de suite", () => {
  it("web et bureau (aucun état d'app injecté) : 4 progressions par minute, comme avant", () => {
    const h = harness();
    h.reporter.started(libraryTrack("a1"), 0);
    play(h, 0, 60_000, 250);
    expect(h.events().filter((e) => e === "progress")).toHaveLength(4);
  });

  it("au premier plan, l'état injecté ne change rien : toutes les 15 s", () => {
    const h = harness({ withAppState: true });
    h.reporter.started(libraryTrack("a1"), 0);
    play(h, 0, 60_000, 250);
    expect(h.events().filter((e) => e === "progress")).toHaveLength(4);
  });

  it("app derrière : une progression par minute, à 60 s d'écart", () => {
    const h = harness({ withAppState: true });
    h.setBackground(true);
    h.reporter.started(libraryTrack("a1"), 0);
    play(h, 0, 5 * 60_000, 250);
    const progress = h.sent.filter((r) => r.event === "progress");
    expect(progress.map((r) => r.positionMs)).toEqual([60_000, 120_000, 180_000, 240_000, 300_000]);
  });

  it("même avec des nouvelles du moteur espacées (5 s, horloge du natif derrière) : jamais moins de 60 s d'écart", () => {
    const h = harness({ withAppState: true });
    h.setBackground(true);
    h.reporter.started(libraryTrack("a1"), 0);
    play(h, 0, 3 * 60_000, 5_000);
    expect(h.sent.filter((r) => r.event === "progress").map((r) => r.positionMs)).toEqual([60_000, 120_000, 180_000]);
  });

  it("début, pause, reprise, arrêt et titre suivant partent tout de suite, app derrière", () => {
    const h = harness({ withAppState: true });
    h.setBackground(true);
    h.reporter.started(libraryTrack("a1"), 0);
    h.advance(3_000);
    h.reporter.paused(3_000);
    h.advance(2_000);
    h.reporter.progress(3_000); // reprise depuis l'écran verrouillé
    h.advance(4_000);
    h.reporter.stopped(7_000, 200_000);
    h.reporter.started(libraryTrack("a2"), 0);
    expect(h.events()).toEqual(["start", "pause", "progress", "stop", "start"]);
  });

  it("revenir au premier plan rattrape aussitôt une progression vieille de plus de 15 s", () => {
    const h = harness({ withAppState: true });
    h.reporter.started(libraryTrack("a1"), 0);
    const pos = play(h, 0, 15_000, 250); // une progression à 15 s, au premier plan
    h.setBackground(true);
    const later = play(h, pos, 40_000, 250); // derrière : rien en 40 s
    expect(h.events()).toEqual(["start", "progress"]);
    h.setBackground(false);
    h.advance(250);
    h.reporter.progress(later + 250);
    expect(h.events()).toEqual(["start", "progress", "progress"]);
  });
});
