import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * Le relais Jellyfin du processus principal. Ce qui se garde ici : les chemins
 * sont CONSTRUITS côté main à partir de morceaux validés (jamais un chemin
 * libre de la page), les schémas refusent toute évasion, et le corps du
 * PlaybackInfo revient tel quel.
 */

const { reseau } = vi.hoisted(() => ({
  reseau: {
    appels: [] as { url: string; init: RequestInit }[],
    statut: 200,
    corps: "",
  },
}));

vi.mock("electron", () => ({
  net: {
    fetch: (url: string, init: RequestInit) => {
      reseau.appels.push({ url, init });
      return Promise.resolve({
        status: reseau.statut,
        text: () => Promise.resolve(reseau.corps),
      });
    },
  },
}));

import { registerJellyfinCommands } from "./jellyfin";
import type { CommandRegistry } from "./registry";

interface Commande {
  schema: { parse: (v: unknown) => unknown; safeParse: (v: unknown) => { success: boolean } };
  run: (args: never) => Promise<unknown>;
}
const commandes = new Map<string, Commande>();
registerJellyfinCommands({
  add: (nom: string, def: Commande) => {
    commandes.set(nom, def);
  },
} as unknown as CommandRegistry);

function commande(nom: string): Commande {
  const c = commandes.get(nom);
  if (c === undefined) throw new Error(`commande absente : ${nom}`);
  return c;
}

beforeEach(() => {
  reseau.appels.length = 0;
  reseau.statut = 200;
  reseau.corps = "";
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
    reseau.corps = "{\"MediaSources\":[]}";
    const r = await commande("jellyfin_playback_info").run(args as never);
    expect(r).toEqual({ status: 200, body: "{\"MediaSources\":[]}" });
    expect(reseau.appels[0]?.url).toBe(
      "https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo?UserId=u1&IsPlayback=true",
    );
    const entetes = reseau.appels[0]?.init.headers as Record<string, string>;
    expect(entetes["X-Emby-Token"]).toBe("jeton");
    expect(reseau.appels[0]?.init.method).toBe("POST");
  });

  it("sans requête, pas de « ? » orphelin", async () => {
    await commande("jellyfin_playback_info").run({ ...args, query: "" } as never);
    expect(reseau.appels[0]?.url).toBe(
      "https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo",
    );
  });

  it("le schéma refuse toute évasion de chemin", () => {
    const schema = commande("jellyfin_playback_info").schema;
    expect(schema.safeParse({ ...args, itemId: "../System" }).success).toBe(false);
    expect(schema.safeParse({ ...args, query: "a=1&b=/autre" }).success).toBe(false);
    expect(schema.safeParse({ ...args, query: "a=1#frag" }).success).toBe(false);
    expect(schema.safeParse(args).success).toBe(true);
  });
});

describe("jellyfin_kill_encodings", () => {
  it("construit le DELETE avec deviceId et playSessionId ENCODÉS", async () => {
    reseau.statut = 204;
    const r = await commande("jellyfin_kill_encodings").run({
      baseUrl: "https://serveur.example",
      deviceId: "appareil un",
      playSessionId: "ps&1",
      token: "jeton",
      authHeader: "MediaBrowser …",
    } as never);
    expect(r).toEqual({ status: 204 });
    expect(reseau.appels[0]?.url).toBe(
      "https://serveur.example/Videos/ActiveEncodings?deviceId=appareil%20un&playSessionId=ps%261",
    );
    expect(reseau.appels[0]?.init.method).toBe("DELETE");
  });
});
