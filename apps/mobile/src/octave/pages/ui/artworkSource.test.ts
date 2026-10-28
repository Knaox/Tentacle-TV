import { describe, expect, it } from "vitest";
import { artworkCacheKey, artworkSource } from "./artworkSource";

describe("la source d'une pochette", () => {
  it("la clé du cache disque ne porte jamais le jeton", () => {
    expect(artworkCacheKey("https://srv/api/music/art/a?w=300&api_key=SECRET")).toBe("https://srv/api/music/art/a?w=300");
    expect(artworkCacheKey("https://srv/Items/x/Images/Primary?api_key=S")).toBe("https://srv/Items/x/Images/Primary");
    expect(artworkCacheKey("https://srv/a?ApiKey=S&tag=1&X-Emby-Token=T")).toBe("https://srv/a?tag=1");
    expect(artworkCacheKey("https://lh3.example/img=w544")).toBe("https://lh3.example/img=w544");
  });
  it("deux jetons, une même pochette : une même clé", () => {
    expect(artworkCacheKey("https://srv/a?api_key=1&w=2")).toBe(artworkCacheKey("https://srv/a?api_key=9&w=2"));
  });
  it("hors ligne, la pochette gardée sur l'appareil passe avant le serveur", () => {
    expect(artworkSource("https://srv/a?api_key=1", "file:///c.jpg", true)).toEqual({ uri: "file:///c.jpg" });
    expect(artworkSource("https://srv/a?api_key=1", "file:///c.jpg", false)).toEqual({ uri: "https://srv/a?api_key=1", cacheKey: "https://srv/a" });
    expect(artworkSource(null, "file:///c.jpg", false)).toEqual({ uri: "file:///c.jpg" });
  });
  it("rien : rien ; une adresse locale garde sa propre clé", () => {
    expect(artworkSource(null, null, true)).toBeNull();
    expect(artworkSource("file:///x.jpg", null, false)).toEqual({ uri: "file:///x.jpg" });
  });
});
