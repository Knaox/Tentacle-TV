import { describe, expect, it } from "vitest";
import type { MusicPlaybackReport } from "../music";
import { libraryTrack } from "./fixtures";
import { PlaybackReporter } from "./playbackReports";

function harness() {
  let now = 1_000;
  const sent: MusicPlaybackReport[] = [];
  const reporter = new PlaybackReporter({ library: (r) => sent.push(r), externalPlayed: () => undefined, now: () => now });
  return { reporter, sent, advance: (ms: number) => (now += ms) };
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
