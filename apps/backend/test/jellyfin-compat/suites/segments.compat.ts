import { expect } from "vitest";
import type { PlaybackSegmentsResponse } from "../../../../../packages/shared/src/playback/segmentTypes";
import { check, feature } from "../harness";
import { backendApi, ctx, okJson, proxy, installedAppHeaders } from "./support";

feature("segments.skip", () => {
  const { bbS01E01 } = ctx().fixtures.episodes;

  check("intro et générique tirés des chapitres (backend /api/playback/segments)", async () => {
    const body = await okJson<PlaybackSegmentsResponse>(backendApi(`/api/playback/segments/${bbS01E01}`, ctx().user.token), "segments");
    expect(body.runtimeMs).toBeGreaterThan(50_000);
    const intro = body.segments.find((s) => s.type === "Intro");
    expect(intro, JSON.stringify(body.segments)).toBeTruthy();
    expect(intro!.startMs).toBe(0);
    expect(intro!.endMs).toBe(8_000);
    if (!body.segments.some((s) => s.type === "Outro")) return { partial: "générique non reconnu depuis le chapitre « Générique »" };
  });

  check("API MediaSegments de Jellyfin joignable par le proxy", async () => {
    const res = await okJson<{ Items: unknown[] }>(proxy(`MediaSegments/${bbS01E01}`, { headers: installedAppHeaders(ctx().user.token) }), "MediaSegments");
    expect(Array.isArray(res.Items)).toBe(true);
  });
});
