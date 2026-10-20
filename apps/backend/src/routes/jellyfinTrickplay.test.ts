/**
 * La vignette de trickplay et le cookie de CONNEXION que garde le téléphone :
 * l'`<Image>` de React Native ne pose pas d'en-tête, la tuile d'un profil part
 * avec `api_key=<jeton du profil>` — et le pot y joint le cookie du COMPTE.
 * Comme au proxy (cf. incomingAuth), le jeton explicite l'emporte : la tuile
 * est jugée et demandée au nom du profil. La page web (cookie seul) ne change pas.
 */

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

const seen = vi.hoisted(() => ({ judged: [] as Array<{ token: string; deviceUser: string | null }>, asked: [] as string[] }));

const PROFILE = "eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InByb2ZpbGUifQ.c2ln";
const ACCOUNT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../services/pairedDeviceStatus", () => ({
  pairedDeviceStatus: async (token: string) =>
    token.split(".").length === 3
      ? { status: "paired", payload: { userId: "u-zoe", username: "Zoé", isAdmin: false, scope: "profile" }, tokenHash: "h" }
      : { status: "not_device" },
  revokedReplyFor: () => ({ revoked: true }),
}));
vi.mock("../services/accountAccess/accountAccessState", () => ({ accountAccessRefusal: async () => null }));
vi.mock("./jellyfinProxy/streamAccess", () => ({
  itemRefused: async (_itemId: string, token: string, deviceUser: string | null) => {
    seen.judged.push({ token, deviceUser });
    return false;
  },
}));

import { jellyfinTrickplayRoutes } from "./jellyfinTrickplay";

beforeEach(() => {
  seen.judged = [];
  seen.asked = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.asked.push(modernJellyfinToken(init?.headers, String(input)));
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { "content-type": "image/jpeg" } });
  }));
});

async function tile(cookieToken: string | null, apiKey?: string) {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jellyfinTrickplayRoutes, { prefix: "/api/jellyfin" });
  const query = apiKey ? `&api_key=${apiKey}` : "";
  return app.inject({
    method: "GET",
    url: `/api/jellyfin/items/abc123/trickplay/320/0.jpg?mediaSourceId=ms1${query}`,
    ...(cookieToken && { cookies: { tentacle_token: cookieToken } }),
  });
}

describe("la vignette face au cookie de connexion du téléphone", () => {
  it("la tuile d'un profil (`api_key`) l'emporte sur le cookie du compte : jugée et demandée pour le profil", async () => {
    expect((await tile(ACCOUNT, PROFILE)).statusCode).toBe(200);
    expect(seen.judged).toEqual([{ token: PROFILE, deviceUser: "u-zoe" }]);
    expect(seen.asked).toEqual(["cle-admin"]);
  });

  it("la page web (cookie seul) : son jeton, tel quel", async () => {
    expect((await tile(ACCOUNT)).statusCode).toBe(200);
    expect(seen.judged).toEqual([{ token: ACCOUNT, deviceUser: null }]);
    expect(seen.asked).toEqual([ACCOUNT]);
  });
});
