import { expect } from "vitest";
import type { MediaItem } from "../../../../../packages/shared/src/types/media";
import { check, feature } from "../harness";
import { ctx, tentacleClient } from "./support";

/**
 * Bonus et bandes-annonces — le chantier de L3-3 ; ici, seulement ce que
 * Jellyfin en rend par les routes que les applications appellent.
 */
feature("extras.trailers", () => {
  const u = () => ctx().user.id;
  const { bbb } = ctx().fixtures.movies;
  const { breakingBad } = ctx().fixtures.series;
  const { bb1 } = ctx().fixtures.seasons;
  const client = () => tentacleClient(ctx().user.token);

  check("bandes-annonces locales d'un film (Users/{u}/Items/{id}/LocalTrailers, traduit)", async () => {
    const trailers = await client().fetch<MediaItem[]>(`/Users/${u()}/Items/${bbb}/LocalTrailers`);
    expect(trailers.length).toBeGreaterThanOrEqual(1);
    expect(trailers.every((t) => t.Id && t.Name)).toBe(true);
  });

  check("bonus d'un film (SpecialFeatures)", async () => {
    const extras = await client().fetch<MediaItem[]>(`/Users/${u()}/Items/${bbb}/SpecialFeatures`);
    expect(extras.length).toBeGreaterThanOrEqual(3);
  });

  check("compteurs sur la fiche (LocalTrailerCount, SpecialFeatureCount)", async () => {
    const item = await client().fetch<MediaItem & { LocalTrailerCount?: number; SpecialFeatureCount?: number }>(
      `/Users/${u()}/Items/${bbb}?Fields=SpecialFeatureCount,LocalTrailerCount`,
    );
    expect(item.LocalTrailerCount ?? 0).toBeGreaterThanOrEqual(1);
    expect(item.SpecialFeatureCount ?? 0).toBeGreaterThanOrEqual(3);
  });

  check("bonus d'une série et d'une saison", async () => {
    const series = await client().fetch<MediaItem[]>(`/Users/${u()}/Items/${breakingBad}/SpecialFeatures`);
    const season = await client().fetch<MediaItem[]>(`/Users/${u()}/Items/${bb1}/SpecialFeatures`);
    expect(series.length).toBeGreaterThanOrEqual(1);
    if (season.length === 0) return { partial: "le dossier extras/ d'une saison n'est pas rattaché à la saison" };
  });
});
