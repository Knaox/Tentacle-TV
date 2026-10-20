import { describe, expect, it } from "vitest";
import {
  castItemPosition, castLoadStart, castPhase, castReachableHost, castReceiverTarget, pickCastUrl, withCastAuth,
} from "./castPlan";

describe("diffusion : une adresse que la TV sait joindre", () => {
  it("accepte une IP ou un vrai domaine", () => {
    expect(castReachableHost("192.168.1.20")).toBe(true);
    expect(castReachableHost("jellyfin.example.org")).toBe(true);
    expect(castReachableHost("[fd00::12]")).toBe(true);
  });

  it("refuse un nom de conteneur, un nom mDNS, la boucle locale", () => {
    expect(castReachableHost("jellyfin")).toBe(false);
    expect(castReachableHost("nas.local")).toBe(false);
    expect(castReachableHost("localhost")).toBe(false);
    expect(castReachableHost("127.0.0.1")).toBe(false);
  });

  it("prend la première adresse joignable, sinon rien", () => {
    expect(pickCastUrl(["http://jellyfin:8096/Videos/1", "https://tv.example.org/Videos/1"])).toBe("https://tv.example.org/Videos/1");
    expect(pickCastUrl([null, "http://192.168.1.2:8096/x"])).toBe("http://192.168.1.2:8096/x");
    expect(pickCastUrl(["http://jellyfin:8096/x", "http://nas.local/x"])).toBeNull();
  });

  it("pose la clé dans l'URL, une seule fois", () => {
    expect(withCastAuth("http://a.b/x?Static=true", "tok")).toBe("http://a.b/x?Static=true&api_key=tok");
    expect(withCastAuth("http://a.b/x", "t k")).toBe("http://a.b/x?api_key=t%20k");
    expect(withCastAuth("http://a.b/x?ApiKey=z", "tok")).toBe("http://a.b/x?ApiKey=z");
    expect(withCastAuth("http://a.b/x", null)).toBe("http://a.b/x");
  });
});

describe("diffusion : positions", () => {
  it("lecture directe : le récepteur se place lui-même", () => {
    expect(castLoadStart(true, 754)).toBe(754);
  });

  it("transcodage : le flux commence déjà à la position", () => {
    expect(castLoadStart(false, 754)).toBe(0);
    expect(castItemPosition(10, 754)).toBe(764);
    expect(castReceiverTarget(800, 754)).toBe(46);
    expect(castReceiverTarget(100, 754)).toBe(0);
  });
});

describe("diffusion : l'état affiché", () => {
  it("suit la connexion puis le récepteur", () => {
    expect(castPhase("connecting", null, null, false)).toBe("connecting");
    expect(castPhase("other", "playing", null, true)).toBe("idle");
    expect(castPhase("connected", null, null, true)).toBe("loading");
    expect(castPhase("connected", "buffering", null, true)).toBe("buffering");
    expect(castPhase("connected", "idle", "finished", true)).toBe("finished");
    expect(castPhase("connected", "idle", "error", true)).toBe("failed");
    expect(castPhase("connected", "idle", null, false)).toBe("idle");
  });
});
