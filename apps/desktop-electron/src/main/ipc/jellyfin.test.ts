import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * Le relais Jellyfin du processus principal. Ce qui se garde ici : les chemins
 * sont CONSTRUITS côté main à partir de morceaux validés (jamais un chemin
 * libre de la page), les schémas refusent toute évasion, et le corps du
 * PlaybackInfo revient tel quel.
 */

const { net } = vi.hoisted(() => ({
  net: {
    calls: [] as { url: string; init: RequestInit }[],
    status: 200,
    responseBody: "",
  },
}));

vi.mock("electron", () => ({
  net: {
    fetch: (url: string, init: RequestInit) => {
      net.calls.push({ url, init });
      return Promise.resolve({
        status: net.status,
        text: () => Promise.resolve(net.responseBody),
      });
    },
  },
}));

import { registerJellyfinCommands } from "./jellyfin";
import type { CommandRegistry } from "./registry";

interface TestCommand {
  schema: { parse: (v: unknown) => unknown; safeParse: (v: unknown) => { success: boolean } };
  run: (args: never) => Promise<unknown>;
}
const commands = new Map<string, TestCommand>();
registerJellyfinCommands({
  add: (name: string, def: TestCommand) => {
    commands.set(name, def);
  },
} as unknown as CommandRegistry);

function command(name: string): TestCommand {
  const c = commands.get(name);
  if (c === undefined) throw new Error(`commande absente : ${name}`);
  return c;
}

beforeEach(() => {
  net.calls.length = 0;
  net.status = 200;
  net.responseBody = "";
});

describe("jellyfin_playback_info", () => {
  const args = {
    baseUrl: "https://serveur.example",
    itemId: "b79c162e7cd612a4",
    query: "UserId=u1&IsPlayback=true",
    token: "jeton",
    authHeader: "MediaBrowser …",
    body: "{\"DeviceProfile\":{}}",
  };

  it("construit le chemin CÔTÉ MAIN et rend statut + corps", async () => {
    net.responseBody = "{\"MediaSources\":[]}";
    const r = await command("jellyfin_playback_info").run(args as never);
    expect(r).toEqual({ status: 200, body: "{\"MediaSources\":[]}" });
    expect(net.calls[0]?.url).toBe(
      "https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo?UserId=u1&IsPlayback=true",
    );
    const headers = net.calls[0]?.init.headers as Record<string, string>;
    expect(headers["X-Emby-Token"]).toBe("jeton");
    expect(net.calls[0]?.init.method).toBe("POST");
  });

  it("sans requête, pas de « ? » orphelin", async () => {
    await command("jellyfin_playback_info").run({ ...args, query: "" } as never);
    expect(net.calls[0]?.url).toBe(
      "https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo",
    );
  });

  it("le schéma refuse toute évasion de chemin", () => {
    const schema = command("jellyfin_playback_info").schema;
    expect(schema.safeParse({ ...args, itemId: "../System" }).success).toBe(false);
    expect(schema.safeParse({ ...args, query: "a=1&b=/autre" }).success).toBe(false);
    expect(schema.safeParse({ ...args, query: "a=1#frag" }).success).toBe(false);
    expect(schema.safeParse(args).success).toBe(true);
  });
});

describe("jellyfin_kill_encodings", () => {
  it("construit le DELETE avec deviceId et playSessionId ENCODÉS", async () => {
    net.status = 204;
    const r = await command("jellyfin_kill_encodings").run({
      baseUrl: "https://serveur.example",
      deviceId: "appareil un",
      playSessionId: "ps&1",
      token: "jeton",
      authHeader: "MediaBrowser …",
    } as never);
    expect(r).toEqual({ status: 204 });
    expect(net.calls[0]?.url).toBe(
      "https://serveur.example/Videos/ActiveEncodings?deviceId=appareil%20un&playSessionId=ps%261",
    );
    expect(net.calls[0]?.init.method).toBe("DELETE");
  });
});
