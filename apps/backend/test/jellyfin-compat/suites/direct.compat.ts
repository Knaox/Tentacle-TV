import { expect } from "vitest";
import type { UserItemData } from "../../../../../packages/shared/src/types/media";
import { sessionPost } from "../../../../../packages/api-client/src/hooks/playbackTransport";
import { check, feature } from "../harness";
import { DIRECT_PROFILE } from "./profiles";
import { backendApi, bodySize, ctx, expectStatus, jellyfin, okJson, tentacleClient } from "./support";

interface StreamingConfig {
  enabled: boolean;
  mediaBaseUrl: string | null;
  jellyfinToken: string | null;
}

async function directConfig(query: string): Promise<StreamingConfig> {
  const body = await okJson<{ directStreaming: StreamingConfig }>(backendApi(`/api/config/streaming${query}`, ctx().user.token), "config/streaming");
  return body.directStreaming;
}

/** Un client en streaming direct, configuré comme les applications le font. */
async function directClient() {
  const config = await directConfig("?jellyfinAuth=modern");
  if (!config.enabled || !config.mediaBaseUrl || !config.jellyfinToken) throw new Error("le serveur n'a pas confié le direct");
  const client = tentacleClient(ctx().user.token, "Direct");
  client.setDirectStreaming({ enabled: true, mediaBaseUrl: config.mediaBaseUrl, jellyfinToken: config.jellyfinToken });
  return client;
}

feature("direct.streaming", () => {
  const { bbb, cosmos } = ctx().fixtures.movies;

  check("le serveur confie le direct à une application à jour", async () => {
    const config = await directConfig("?jellyfinAuth=modern");
    expect(config.enabled).toBe(true);
    expect(config.mediaBaseUrl).toBe(ctx().jellyfin.url);
  });

  check("et le garde pour lui face à une application ancienne quand Jellyfin coupe l'auth héritée", async () => {
    expect((await directConfig("")).enabled).toBe(false);
  }, { skip: ctx().jellyfin.legacyAuth !== false });

  check("PlaybackInfo en direct (en-tête Authorization)", async () => {
    const client = await directClient();
    const info = await client.getPlaybackInfo(bbb, { userId: ctx().user.id, deviceProfile: DIRECT_PROFILE });
    expect(info.MediaSources[0]?.SupportsDirectPlay).toBe(true);
    expect(client.getDirectStreaming()).not.toBeNull();
  });

  check("flux direct (URL en ApiKey), requête partielle", async () => {
    const client = await directClient();
    const url = client.getStreamUrl(bbb, { mediaSourceId: bbb });
    expect(url.startsWith(ctx().jellyfin.url)).toBe(true);
    expect(url).toMatch(/[?&]ApiKey=/);
    const res = await fetch(url, { headers: { Range: "bytes=0-4095" } });
    expectStatus(res, 206);
    expect(await bodySize(res)).toBe(4096);
  });

  check("sous-titres et images restent au proxy, flux en direct", async () => {
    const client = await directClient();
    expect(client.getImageUrl(bbb, "Primary").startsWith(`${ctx().backend.url}/api/jellyfin`)).toBe(true);
  });

  check("télémétrie en direct : la position est gardée (sessionPost)", async () => {
    const client = await directClient();
    const base = { ItemId: cosmos, MediaSourceId: cosmos, PlaySessionId: `compat-direct-${Date.now()}`, PlayMethod: "DirectPlay", CanSeek: true };
    await sessionPost(client, "/Sessions/Playing", { ...base, PositionTicks: 0, IsPaused: false }, "start");
    await sessionPost(client, "/Sessions/Playing/Stopped", { ...base, PositionTicks: 160_000_000 }, "stop");
    const data = await okJson<UserItemData>(jellyfin(`/UserItems/${cosmos}/UserData?userId=${ctx().user.id}`, ctx().apiKey), "UserData");
    expect(data.PlaybackPositionTicks).toBe(160_000_000);
  });
});
