import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseCorsOrigins, type CorsContext } from "./tentacleCors";

const ctx = (over: Partial<CorsContext> = {}): CorsContext => ({
  listed: ["https://ancien.example.com"],
  self: "https://tv.example.com",
  publicUrl: "https://tv.example.com",
  localUrl: "http://192.168.1.20:3000",
  ...over,
});

describe("le CORS de Tentacle", () => {
  it("sans CORS_ORIGINS, tout le monde (comme toujours)", () => {
    expect(isAllowedOrigin("https://n-importe.example", ctx({ listed: [] }))).toBe(true);
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins(" https://a.example , ,https://b.example")).toEqual(["https://a.example", "https://b.example"]);
  });

  it("avec CORS_ORIGINS : la liste, les applications de bureau, et les adresses réglées sans les y recopier", () => {
    for (const origin of ["https://ancien.example.com", "tentacle://app", "tauri://localhost", "https://tv.example.com", "http://192.168.1.20:3000", undefined]) {
      expect(isAllowedOrigin(origin, ctx())).toBe(true);
    }
  });

  it("la page servie par Tentacle lui-même passe toujours, par quelque adresse qu'on l'ouvre", () => {
    expect(isAllowedOrigin("http://nas.local:3000", ctx({ self: "http://nas.local:3000", publicUrl: null, localUrl: null }))).toBe(true);
  });

  it("une origine étrangère est refusée", () => {
    expect(isAllowedOrigin("https://evil.example", ctx())).toBe(false);
    expect(isAllowedOrigin("null", ctx())).toBe(false);
  });
});
