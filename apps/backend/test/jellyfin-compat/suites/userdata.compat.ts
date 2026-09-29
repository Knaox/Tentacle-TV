import { expect } from "vitest";
import type { UserItemData } from "../../../../../packages/shared/src/types/media";
import { sessionPost } from "../../../../../packages/api-client/src/hooks/playbackTransport";
import { clearPlayedWhenResumable } from "../../../../../packages/api-client/src/hooks/resumeOverPlayed";
import { check, feature } from "../harness";
import { pairedDeviceToken, tvHeaders } from "./pairedDevice";
import { ctx, expectStatus, jellyfin, okJson, proxy, tentacleClient, type ItemsPage } from "./support";

const userData = (itemId: string, userId = ctx().user.id): Promise<UserItemData> =>
  okJson<UserItemData>(jellyfin(`/UserItems/${itemId}/UserData?userId=${userId}`, ctx().apiKey), "UserData");

feature("userdata.lists", () => {
  const u = () => ctx().user.id;
  const { cosmos, elephants } = ctx().fixtures.movies;
  const client = () => tentacleClient(ctx().user.token);

  check("favori posé et retiré (Users/{u}/FavoriteItems, traduit)", async () => {
    await client().fetch(`/Users/${u()}/FavoriteItems/${cosmos}`, { method: "POST" });
    expect((await userData(cosmos)).IsFavorite).toBe(true);
    await client().fetch(`/Users/${u()}/FavoriteItems/${cosmos}`, { method: "DELETE" });
    expect((await userData(cosmos)).IsFavorite).toBe(false);
  });

  check("« Ma liste » posée et retirée (Rating?likes=true)", async () => {
    await client().fetch(`/Users/${u()}/Items/${elephants}/Rating?likes=true`, { method: "POST" });
    expect((await userData(elephants)).Likes).toBe(true);
    const list = await client().fetch<ItemsPage<{ Id: string }>>(`/Users/${u()}/Items?Filters=Likes&Recursive=true&IncludeItemTypes=Movie,Series&EnableUserData=true`);
    expect(list.Items.map((i) => i.Id)).toContain(elephants);
    await client().fetch(`/Users/${u()}/Items/${elephants}/Rating`, { method: "DELETE" });
    expect((await userData(elephants)).Likes ?? null).toBeNull();
  });

  check("« vu » posé et retiré (Users/{u}/PlayedItems, traduit)", async () => {
    await client().fetch(`/Users/${u()}/PlayedItems/${cosmos}?datePlayed=${encodeURIComponent(new Date().toISOString())}`, { method: "POST" });
    expect((await userData(cosmos)).Played).toBe(true);
    await client().fetch(`/Users/${u()}/PlayedItems/${cosmos}`, { method: "DELETE" });
    expect((await userData(cosmos)).Played).toBe(false);
  });

  check("la liste d'un compte ne déborde pas sur un autre", async () => {
    await client().fetch(`/Users/${u()}/FavoriteItems/${elephants}`, { method: "POST" });
    expect((await userData(elephants, ctx().user2.id)).IsFavorite).toBe(false);
    await client().fetch(`/Users/${u()}/FavoriteItems/${elephants}`, { method: "DELETE" });
  });
});

feature("userdata.resume", () => {
  const { tears } = ctx().fixtures.movies;
  // Un épisode que les autres suites ne touchent pas (« à suivre » vit sur Breaking Bad).
  const bbS01E03 = ctx().fixtures.episodes.bebopS01E01;

  check("report de lecture par le proxy : la position est gardée (sessionPost de l'api-client)", async () => {
    const client = tentacleClient(ctx().user.token);
    const base = { ItemId: tears, MediaSourceId: tears, PlaySessionId: `compat-${Date.now()}`, PlayMethod: "DirectPlay", CanSeek: true };
    await sessionPost(client, "/Sessions/Playing", { ...base, PositionTicks: 0, IsPaused: false }, "start");
    await sessionPost(client, "/Sessions/Playing/Progress", { ...base, PositionTicks: 200_000_000, IsPaused: false }, "progress");
    await sessionPost(client, "/Sessions/Playing/Stopped", { ...base, PositionTicks: 250_000_000 }, "stop");
    expect((await userData(tears)).PlaybackPositionTicks).toBe(250_000_000);
  });

  check("écriture directe de la reprise (UserItems/{id}/UserData)", async () => {
    const client = tentacleClient(ctx().user.token);
    await client.fetch(`/UserItems/${bbS01E03}/UserData`, { method: "POST", body: JSON.stringify({ PlaybackPositionTicks: 120_000_000, LastPlayedDate: new Date().toISOString() }) });
    expect((await userData(bbS01E03)).PlaybackPositionTicks).toBe(120_000_000);
  });

  check("« vu » retiré quand la reprise l'emporte (clearPlayedWhenResumable)", async () => {
    const client = tentacleClient(ctx().user.token);
    await client.fetch(`/UserItems/${bbS01E03}/UserData`, { method: "POST", body: JSON.stringify({ Played: true, PlaybackPositionTicks: 100_000_000 }) });
    await clearPlayedWhenResumable(client, bbS01E03);
    const after = await userData(bbS01E03);
    expect(after.Played).toBe(false);
    expect(after.PlaybackPositionTicks).toBe(100_000_000);
  });
});

feature("userdata.paired-devices", () => {
  const { elephants } = ctx().fixtures.movies;

  check("le téléviseur lit la bibliothèque de SON compte (clé admin substituée)", async () => {
    const jwt = await pairedDeviceToken();
    const body = await okJson<ItemsPage>(proxy(`Users/${ctx().user.id}/Items?Recursive=true&IncludeItemTypes=Movie&Limit=5`, { headers: tvHeaders(jwt) }), "bibliothèque du téléviseur");
    expect(body.Items.length).toBeGreaterThan(0);
  });

  check("le garde refuse le compte d'un autre, par le chemin comme par la query", async () => {
    const jwt = await pairedDeviceToken();
    expectStatus(await proxy(`Users/${ctx().user2.id}/Items?Recursive=true`, { headers: tvHeaders(jwt) }), 403);
    expectStatus(await proxy(`Items?userId=${ctx().user2.id}&Recursive=true`, { headers: tvHeaders(jwt) }), 403);
  });

  check("report de lecture sans jeton Jellyfin : la reprise est écrite sur son compte", async () => {
    const jwt = await pairedDeviceToken();
    const res = await proxy("Sessions/Playing/Progress", {
      method: "POST",
      headers: { ...tvHeaders(jwt), "Content-Type": "application/json" },
      body: JSON.stringify({ ItemId: elephants, MediaSourceId: elephants, PositionTicks: 180_000_000, IsPaused: true, PlaySessionId: "compat-tv-session" }),
    });
    expectStatus(res, 200, 204);
    expect((await userData(elephants)).PlaybackPositionTicks).toBe(180_000_000);
  });
});
