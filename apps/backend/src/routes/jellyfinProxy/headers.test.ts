import { describe, it, expect } from "vitest";
import { buildForwardHeaders, imageCacheControl, skipResponseHeader } from "./headers";

const IMAGE = { media: false, image: true };
const API = { media: false, image: false };
const MEDIA = { media: true, image: false };

describe("skipResponseHeader", () => {
  it("écarte l'Age de l'amont sur une image : il se soustrairait à NOTRE max-age", () => {
    expect(skipResponseHeader("age", IMAGE)).toBe(true);
  });

  it("garde l'Age hors des images — le proxy n'y pose pas sa propre fraîcheur", () => {
    expect(skipResponseHeader("age", API)).toBe(false);
    expect(skipResponseHeader("age", MEDIA)).toBe(false);
  });

  it("garde de quoi revalider une image", () => {
    expect(skipResponseHeader("last-modified", IMAGE)).toBe(false);
    expect(skipResponseHeader("etag", IMAGE)).toBe(false);
    expect(skipResponseHeader("content-type", IMAGE)).toBe(false);
  });

  it("écarte toujours les en-têtes de saut", () => {
    for (const kind of [IMAGE, API, MEDIA]) {
      expect(skipResponseHeader("transfer-encoding", kind)).toBe(true);
      expect(skipResponseHeader("connection", kind)).toBe(true);
    }
  });

  it("ne transmet la longueur et l'encodage que pour les flux", () => {
    expect(skipResponseHeader("content-length", API)).toBe(true);
    expect(skipResponseHeader("content-encoding", IMAGE)).toBe(true);
    expect(skipResponseHeader("content-length", MEDIA)).toBe(false);
  });
});

describe("imageCacheControl", () => {
  it("met en cache les images, et elles seules", () => {
    expect(imageCacheControl("Items/abc/Images/Primary")).toMatch(/max-age=86400/);
    expect(imageCacheControl("Users/abc/Items")).toBeNull();
    expect(imageCacheControl("Users/abc/Items", "tag")).toBeNull();
  });

  it("garde un an la photo d'un compte demandée avec son étiquette : l'adresse change avec la photo", () => {
    expect(imageCacheControl("Users/abc/Images/Primary", "5f0e")).toBe("private, max-age=31536000, immutable");
  });

  it("ne garde pas la photo d'un compte sans étiquette — une adresse fixe resservirait l'ancienne", () => {
    expect(imageCacheControl("Users/abc/Images/Primary")).toBeNull();
    expect(imageCacheControl("Users/abc/Images/Primary", "")).toBeNull();
  });
});

describe("buildForwardHeaders", () => {
  const identity = { Client: "Tentacle TV - TV", Device: "AndroidTV", DeviceId: "d-1", Version: "2.0" };

  it("ne relaie AUCUN en-tête d'authentification tel quel — Jellyfin 12 les refuse", () => {
    const out = buildForwardHeaders(
      {
        "x-emby-token": "jwt",
        "x-emby-authorization": 'MediaBrowser Token="jwt"',
        "x-mediabrowser-token": "jwt",
        authorization: "Bearer jwt",
        accept: "application/json",
      },
      { identity, token: "cle-admin" },
    );
    expect(Object.keys(out).map((k) => k.toLowerCase()).sort()).toEqual(["accept", "authorization"]);
    expect(out.Authorization).toBe('MediaBrowser Client="Tentacle TV - TV", Device="AndroidTV", DeviceId="d-1", Version="2.0", Token="cle-admin"');
  });

  it("sans identité ni jeton, pas d'en-tête : la route est publique", () => {
    const out = buildForwardHeaders({ "accept-language": "fr-FR" }, { identity: null, token: undefined });
    expect(out).toEqual({ "accept-language": "fr-FR" });
  });

  it("écarte toujours les en-têtes de saut", () => {
    const out = buildForwardHeaders({ host: "x", connection: "keep-alive", "content-length": "12" }, { identity: null, token: "t" });
    expect(out).toEqual({ Authorization: 'MediaBrowser Token="t"' });
  });
});
