import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { collectionStages, trackFraction, trackStage } from "./keptProgress";
import { ProgressRing } from "./ProgressRing";

// « Préparation… » distincte du transfert (28/10) : la marque ne montre plus un transfert « commencé » figé
// pendant que le serveur prépare le titre.

function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key, trackKey: key, origin: "external", variant: "original", preset: null, status: "downloading", errorCode: null,
    pausedByUser: false, bytesDone: 0, expectedSize: null, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: "/api/plugins/x/music/offline/1", trackJson: "{}",
    createdAt: 0, ...partial,
  };
}

describe("trackStage", () => {
  it("en file, préparation (demande partie, ou 503 en attente de relance), transfert", () => {
    expect(trackStage(kept("a", { status: "queued" }))).toBe("waiting");
    expect(trackStage(kept("a", { preparing: true }))).toBe("preparing");
    expect(trackStage(kept("a", { status: "paused", preparing: true }))).toBe("preparing");
    expect(trackStage(kept("a", { bytesDone: 10, expectedSize: 100 }))).toBe("transferring");
  });

  it("une préparation restée en base n'est pas dite pour un titre en file ou mis en pause par la personne", () => {
    expect(trackStage(kept("a", { status: "queued", preparing: true }))).toBe("waiting");
    expect(trackStage(kept("a", { status: "paused", pausedByUser: true, preparing: true }))).toBe("waiting");
  });

  it("gardé, en défaut, rien : comme avant", () => {
    expect(trackStage(kept("a", { status: "complete" }))).toBe("complete");
    expect(trackStage(kept("a", { status: "error" }))).toBe("failed");
    expect(trackStage(null)).toBe("none");
  });

  it("la fraction d'un titre dont la taille est apprise en route (le pilote l'annonce)", () => {
    expect(trackFraction(kept("a", { bytesDone: 1_000_000, expectedSize: 4_000_000 }))).toBe(0.25);
    expect(trackFraction(kept("a"))).toBe(0);
  });
});

describe("collectionStages", () => {
  it("une playlist dit combien de ses titres attendent, se préparent, arrivent", () => {
    const byKey = new Map(
      [
        kept("a", { status: "complete" }),
        kept("b", { preparing: true }),
        kept("c", { preparing: true }),
        kept("d", { bytesDone: 5, expectedSize: 10 }),
        kept("e", { status: "queued" }),
      ].map((k) => [k.trackKey, k]),
    );
    expect(collectionStages(["a", "b", "c", "d", "e", "z"], byKey)).toEqual({ waiting: 1, preparing: 2, transferring: 1 });
  });
});

describe("ProgressRing", () => {
  it("préparation : un anneau en pointillés, immobile ; en file : vide et pâle ; transfert : il se remplit", () => {
    const preparing = renderToStaticMarkup(<ProgressRing fraction={0} mode="preparing" />);
    expect(preparing).toContain('data-ring="preparing"');
    expect(preparing).toContain("stroke-dasharray");
    expect(preparing).not.toContain("transition");
    expect(renderToStaticMarkup(<ProgressRing fraction={0} mode="waiting" />)).toContain('stroke-opacity="0.3"');
    expect(renderToStaticMarkup(<ProgressRing fraction={0.5} />)).toContain("stroke-dashoffset");
  });
});
