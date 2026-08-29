/**
 * Le verrou du Direct Streaming.
 *
 * Le défaut qu'il ferme : le repli CORS coupait bien le direct, mais la
 * resynchronisation de la config admin (`DirectStreamingSync`) le rallumait
 * aussitôt — et la lecture suivante repayait les deux allers-retours perdus,
 * plus un rechargement visible du lecteur.
 */

import { describe, expect, it } from "vitest";
import { JellyfinClient } from "./jellyfin";
import type { StorageAdapter, UuidGenerator } from "./storage";

const CONFIG = {
  enabled: true,
  mediaBaseUrl: "https://jellyfin.exemple.tld",
  jellyfinToken: "jeton-utilisateur",
};

function storage(): StorageAdapter {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const uuid: UuidGenerator = { randomUUID: () => "device-fixe" };

function client(): JellyfinClient {
  return new JellyfinClient("/api/jellyfin", storage(), uuid);
}

describe("verrou du Direct Streaming", () => {
  it("accepte la config tant que rien n'a été refusé", () => {
    const c = client();
    c.setDirectStreaming(CONFIG);
    expect(c.getDirectStreaming()).toEqual(CONFIG);
  });

  it("coupe le direct dès le premier refus constaté", () => {
    const c = client();
    c.setDirectStreaming(CONFIG);
    c.signalDirectStreamingBlocked("test");
    expect(c.getDirectStreaming()).toBeNull();
  });

  it("tient face à une resynchronisation de la config admin", () => {
    const c = client();
    c.setDirectStreaming(CONFIG);
    c.signalDirectStreamingBlocked("test");
    // Ce que fait DirectStreamingSync à chaque refetch de la config.
    c.setDirectStreaming(CONFIG);
    expect(c.getDirectStreaming()).toBeNull();
  });

  it("laisse toujours passer une coupure explicite (admin qui désactive)", () => {
    const c = client();
    c.signalDirectStreamingBlocked("test");
    c.setDirectStreaming(null);
    expect(c.getDirectStreaming()).toBeNull();
  });

  it("se pose une seule fois, même signalé plusieurs fois", () => {
    const c = client();
    c.setDirectStreaming(CONFIG);
    c.signalDirectStreamingBlocked("premier");
    c.signalDirectStreamingBlocked("second");
    expect(c.getDirectStreaming()).toBeNull();
  });
});
