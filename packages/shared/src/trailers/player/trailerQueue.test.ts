import { describe, expect, it } from "vitest";
import type { TrailerEntry } from "../trailerCatalog";
import {
  isEmbedFallback, trailerFailureStep, trailerNeighborIndex, trailerOriginLabel, trailerQueueOf, trailerReportBody,
  trailerResolveQuery, trailerVersionLabelKey,
} from "./trailerQueue";

const yt = { kind: "youtube" as const, ytId: "Way9Dexny3w" };
const dm = { kind: "dailymotion" as const, videoId: "x8e90ff" };
const entry = (playback: TrailerEntry["playback"], name: string): TrailerEntry => ({
  scope: { kind: "season", season: 6 }, playback, name, version: "localized", type: "trailer", source: "allocine",
});

describe("la file du lecteur complet", () => {
  it("ne garde que ce que le relais lit, dans l'ordre du serveur", () => {
    const queue = trailerQueueOf([entry({ kind: "jellyfin", itemId: "a" }, "locale"), entry(dm, "VF"), entry(yt, "VO")]);
    expect(queue.map((q) => q.name)).toEqual(["VF", "VO"]);
    expect(queue[0].scope).toEqual({ kind: "season", season: 6 });
  });

  it("demande `ytId` ou `dmId`, et rend compte de même", () => {
    expect(trailerResolveQuery(yt)).toBe("ytId=Way9Dexny3w");
    expect(trailerResolveQuery(dm)).toBe("dmId=x8e90ff");
    expect(trailerReportBody(dm, { ok: false, ms: 15000.4, reason: "x".repeat(300) })).toEqual({ dmId: "x8e90ff", ok: false, ms: 15000, reason: "x".repeat(200) });
    expect(trailerReportBody(yt, { ok: true, ms: -3 })).toEqual({ ytId: "Way9Dexny3w", ok: true, ms: 0 });
  });

  it("reconnaît le refus qui demande le lecteur officiel", () => {
    expect(isEmbedFallback(409, { fallback: "embed" })).toBe(true);
    expect(isEmbedFallback(404, { fallback: "embed" })).toBe(false);
    expect(isEmbedFallback(409, { error: "x" })).toBe(false);
  });

  it("après un échec : officiel si le serveur bride YouTube, sinon la suivante, puis l'officiel ou la fin", () => {
    expect(trailerFailureStep(yt, { index: 0, count: 3 }, "embed")).toBe("embed");
    expect(trailerFailureStep(yt, { index: 0, count: 3 }, "failed")).toBe("next");
    expect(trailerFailureStep(yt, { index: 2, count: 3 }, "failed")).toBe("embed");
    expect(trailerFailureStep(dm, { index: 0, count: 2 }, "embed")).toBe("next");
    expect(trailerFailureStep(dm, { index: 1, count: 2 }, "failed")).toBe("close");
  });

  it("précédente et suivante, sans boucler", () => {
    expect(trailerNeighborIndex(0, 3, 1)).toBe(1);
    expect(trailerNeighborIndex(2, 3, 1)).toBeNull();
    expect(trailerNeighborIndex(0, 3, -1)).toBeNull();
  });

  it("dit VF, VOSTFR, VO à un serveur français ; les mots de l'interface ailleurs", () => {
    expect(trailerVersionLabelKey("localized", "fr-FR")).toBe("vf");
    expect(trailerVersionLabelKey("subtitled", "fr")).toBe("vostfr");
    expect(trailerVersionLabelKey("original", "fr")).toBe("vo");
    expect(trailerVersionLabelKey("localized", "en")).toBe("localized");
    expect(trailerVersionLabelKey("unknown", "fr")).toBeNull();
    expect(trailerVersionLabelKey(undefined, "fr")).toBeNull();
  });

  it("nomme l'origine : AlloCiné avant la plateforme", () => {
    expect(trailerOriginLabel({ playback: dm, source: "allocine" })).toBe("allocine");
    expect(trailerOriginLabel({ playback: yt, source: "tmdb" })).toBe("youtube");
  });
});
