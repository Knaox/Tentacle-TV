import { describe, it, expect } from "vitest";
import { urlCible } from "./urlCible";

const BASE = "http://jellyfin.local:8096";

describe("urlCible", () => {
  it("assemble base, chemin et requête", () => {
    expect(urlCible(BASE, "Users/1/Items", "?Limit=20")).toBe(`${BASE}/Users/1/Items?Limit=20`);
  });

  it("laisse une URL sans requête intacte", () => {
    expect(urlCible(BASE, "System/Info", "")).toBe(`${BASE}/System/Info`);
  });

  it("retire la clé d'API sous ses deux orthographes", () => {
    expect(urlCible(BASE, "Items", "?api_key=secret&Limit=5")).not.toContain("secret");
    expect(urlCible(BASE, "Items", "?ApiKey=secret&Limit=5")).not.toContain("secret");
  });

  it("conserve les autres paramètres en retirant la clé", () => {
    expect(urlCible(BASE, "Items", "?api_key=secret&Limit=5")).toContain("Limit=5");
  });

  it("retire StartTimeTicks d'un segment HLS, que Jellyfin refuserait par un 400", () => {
    const url = urlCible(BASE, "Videos/a/hls1/main/3.mp4", "?StartTimeTicks=600000000&x=1");
    expect(url).not.toContain("StartTimeTicks");
    expect(url).toContain("x=1");
  });

  it("le retire aussi en casse basse, celle que Jellyfin propage parfois", () => {
    expect(urlCible(BASE, "Videos/a/hls1/main/3.mp4", "?startTimeTicks=600000000"))
      .not.toContain("imeTicks");
  });

  it("le CONSERVE sur le manifeste, où il commande la position de départ", () => {
    expect(urlCible(BASE, "Videos/a/hls1/main/main.m3u8", "?StartTimeTicks=600000000"))
      .toContain("StartTimeTicks=600000000");
  });

  it("ne touche pas à StartTimeTicks hors des routes hls1", () => {
    expect(urlCible(BASE, "Videos/a/stream.mp4", "?StartTimeTicks=600000000"))
      .toContain("StartTimeTicks=600000000");
  });

  it("rend l'URL telle quelle quand elle n'est pas analysable", () => {
    expect(urlCible("pas-une-base", "Items", "?api_key=secret")).toBe("pas-une-base/Items?api_key=secret");
  });
});
