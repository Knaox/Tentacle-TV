import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { RATE_LIMIT_API, RATE_LIMIT_IMAGES, isImage, rateLimitKey, rateLimitMax } from "./rateLimitPolicy";

const request = (url: string) => ({ url, ip: "192.0.2.10" }) as FastifyRequest;

describe("politique de débit", () => {
  it("range images et flux relayés des bandes-annonces dans le seau des octets", () => {
    expect(isImage("/api/jellyfin/Items/abc/Images/Primary?tag=1")).toBe(true);
    expect(isImage("/api/trailers/hls/Way9Dexny3w/s/270/12.ts?t=x")).toBe(true);
    expect(isImage("/api/trailers/hls/Way9Dexny3w/master.m3u8?t=x")).toBe(true);
    expect(isImage("/api/trailers/file/Way9Dexny3w.mp4?t=x")).toBe(true);
    expect(rateLimitMax(request("/api/trailers/hls/Way9Dexny3w/p/270.m3u8"))).toBe(RATE_LIMIT_IMAGES);
    expect(rateLimitKey(request("/api/trailers/hls/Way9Dexny3w/p/270.m3u8"))).toBe("img:192.0.2.10");
  });

  it("laisse dans le seau de l'API ce qui fait travailler le serveur", () => {
    for (const url of ["/api/trailers/resolve?ytId=Way9Dexny3w", "/api/trailers/prepare?ytId=x", "/api/trailers/report", "/api/auth/login"]) {
      expect(isImage(url)).toBe(false);
      expect(rateLimitMax(request(url))).toBe(RATE_LIMIT_API);
      expect(rateLimitKey(request(url))).toBe("192.0.2.10");
    }
  });
});
