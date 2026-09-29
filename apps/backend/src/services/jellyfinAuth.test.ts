import { describe, expect, it } from "vitest";
import {
  forwardedAuthorization,
  jellyfinAuthHeaders,
  jellyfinTokenAuth,
  parseMediaBrowserAuth,
  tokenFromAuthHeaders,
  tokenFromQuery,
} from "./jellyfinAuth";

describe("jellyfinTokenAuth", () => {
  it("pose le jeton dans un en-tête MediaBrowser, la seule forme que 12.x accepte", () => {
    expect(jellyfinAuthHeaders("abc123")).toEqual({ Authorization: 'MediaBrowser Token="abc123"' });
  });

  it("ne laisse pas un jeton refermer la valeur pour greffer un autre champ", () => {
    expect(jellyfinTokenAuth('x", DeviceId="vole')).toBe('MediaBrowser Token="x,DeviceId=vole"');
  });
});

describe("parseMediaBrowserAuth", () => {
  it("lit les champs comme Jellyfin, virgule entre guillemets comprise", () => {
    const params = parseMediaBrowserAuth('MediaBrowser Client="Tentacle, TV", Device="Web", DeviceId="d-1", Version="1.2", Token="t0k"');
    expect(params).toEqual({ Client: "Tentacle, TV", Device: "Web", DeviceId: "d-1", Version: "1.2", Token: "t0k" });
  });

  it("accepte l'ancien schéma Emby et refuse tout autre schéma", () => {
    expect(parseMediaBrowserAuth('Emby Token="t"')).toEqual({ Token: "t" });
    expect(parseMediaBrowserAuth("Bearer eyJ.abc")).toBeNull();
    expect(parseMediaBrowserAuth("MediaBrowser")).toBeNull();
    expect(parseMediaBrowserAuth(undefined)).toBeNull();
  });
});

describe("tokenFromAuthHeaders", () => {
  it("lit les en-têtes des clients anciens", () => {
    expect(tokenFromAuthHeaders({ "x-emby-token": "a" })).toBe("a");
    expect(tokenFromAuthHeaders({ "x-mediabrowser-token": "b" })).toBe("b");
    expect(tokenFromAuthHeaders({ "x-emby-authorization": 'MediaBrowser Client="X", Token="c"' })).toBe("c");
  });

  it("lit l'en-tête Authorization des clients à jour, mais pas un Bearer", () => {
    expect(tokenFromAuthHeaders({ authorization: 'MediaBrowser Token="d"' })).toBe("d");
    expect(tokenFromAuthHeaders({ authorization: "Bearer jwt" })).toBeUndefined();
  });

  it("préfère X-Emby-Token, que le proxy a toujours lu en premier", () => {
    expect(tokenFromAuthHeaders({ "x-emby-token": "a", authorization: 'MediaBrowser Token="d"' })).toBe("a");
  });
});

describe("tokenFromQuery", () => {
  it("accepte api_key, ApiKey et toute casse", () => {
    expect(tokenFromQuery({ api_key: "a" })).toBe("a");
    expect(tokenFromQuery({ ApiKey: "b" })).toBe("b");
    expect(tokenFromQuery({ apikey: "c" })).toBe("c");
    expect(tokenFromQuery({ other: "x" })).toBeUndefined();
    expect(tokenFromQuery(undefined)).toBeUndefined();
  });
});

describe("forwardedAuthorization", () => {
  it("garde l'identité d'appareil du client et y met le jeton effectif", () => {
    const identity = parseMediaBrowserAuth('MediaBrowser Client="Tentacle", Device="TV", DeviceId="d-1", Version="2.0", Token="jwt"');
    expect(forwardedAuthorization(identity, "cle-admin")).toBe(
      'MediaBrowser Client="Tentacle", Device="TV", DeviceId="d-1", Version="2.0", Token="cle-admin"',
    );
  });

  it("sans identité, le jeton seul ; sans rien, aucun en-tête", () => {
    expect(forwardedAuthorization(null, "t")).toBe('MediaBrowser Token="t"');
    expect(forwardedAuthorization(null, undefined)).toBeNull();
  });

  it("garde l'identité seule pour une connexion (AuthenticateByName n'a pas encore de jeton)", () => {
    const identity = parseMediaBrowserAuth('MediaBrowser Client="Tentacle", Device="Web", DeviceId="d", Version="1"');
    expect(forwardedAuthorization(identity, undefined)).toBe('MediaBrowser Client="Tentacle", Device="Web", DeviceId="d", Version="1"');
  });

  it("retire le hors-ASCII que Kestrel refuserait en 400", () => {
    const identity = { Device: "Téléviseur" };
    expect(forwardedAuthorization(identity, undefined)).toBe('MediaBrowser Device="Tlviseur"');
  });
});
