import { expect } from "vitest";
import type { MediaItem } from "../../../../../packages/shared/src/types/media";
import { buildTrickplayTileUrl } from "../../../../../packages/api-client/src/jellyfin/trickplayUrl";
import { check, feature } from "../harness";
import { bodySize, ctx, expectStatus, installedAppHeaders, proxy, tentacleClient } from "./support";

/** Un PNG d'un pixel : l'avatar le plus petit qu'accepte Jellyfin. */
const PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

feature("media.images", () => {
  const { bbb } = ctx().fixtures.movies;
  const { breakingBad } = ctx().fixtures.series;

  check("affiche d'un film et d'une série (getImageUrl)", async () => {
    const client = tentacleClient(ctx().user.token);
    for (const id of [bbb, breakingBad]) {
      const res = await fetch(client.getImageUrl(id, "Primary", { width: 300 }));
      expectStatus(res, 200);
      expect(res.headers.get("content-type") ?? "").toMatch(/^image\//);
      expect(await bodySize(res)).toBeGreaterThan(100);
    }
  });

  check("fond (Backdrop) d'un film", async () => {
    const res = await fetch(tentacleClient(ctx().user.token).getImageUrl(bbb, "Backdrop", { width: 1280 }));
    if (res.status === 404) return { partial: "aucun fond (métadonnées TMDB indisponibles au scan)" };
    expectStatus(res, 200);
  });

  check("avatar d'un compte posé puis lu (Users/{u}/Images/Primary, traduit en UserImage)", async () => {
    const path = `Users/${ctx().user2.id}/Images/Primary`;
    const upload = await proxy(path, {
      method: "POST",
      headers: { ...installedAppHeaders(ctx().user2.token), "Content-Type": "image/png" },
      body: PIXEL_PNG,
    });
    expectStatus(upload, 204, 200);
    const res = await proxy(`${path}?maxWidth=160&quality=90`, { headers: installedAppHeaders(ctx().user2.token) });
    expectStatus(res, 200);
    expect(res.headers.get("content-type") ?? "").toMatch(/^image\//);
  });
});

feature("media.trickplay", () => {
  const { bbb } = ctx().fixtures.movies;

  const manifest = async (): Promise<{ msId: string; width: number }> => {
    const item = await tentacleClient(ctx().user.token).fetch<MediaItem>(`/Users/${ctx().user.id}/Items/${bbb}?Fields=Trickplay,MediaSources`);
    const byMs = item.Trickplay ?? {};
    const msId = Object.keys(byMs)[0];
    const width = msId ? Number(Object.keys(byMs[msId] ?? {})[0]) : NaN;
    if (!msId || !Number.isFinite(width)) throw new Error("aucun manifeste trickplay sur la fiche (Fields=Trickplay)");
    return { msId, width };
  };

  check("manifeste trickplay sur la fiche (Fields=Trickplay)", async () => {
    const { width } = await manifest();
    expect(width).toBeGreaterThan(0);
  });

  check("planche trickplay par la route du backend (buildTrickplayTileUrl)", async () => {
    const { msId, width } = await manifest();
    const url = buildTrickplayTileUrl(`${ctx().backend.url}/api/jellyfin`, ctx().user.token, bbb, msId, width, 0);
    const res = await fetch(url);
    expectStatus(res, 200);
    expect(res.headers.get("content-type") ?? "").toMatch(/image\/jpeg/);
  });
});
