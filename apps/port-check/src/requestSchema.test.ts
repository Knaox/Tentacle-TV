import { describe, expect, it } from "vitest";
import { checkRequestSchema, isHostname } from "./requestSchema";

const challenge = { id: "a".repeat(32), token: "b".repeat(32) };
const ok = (targets: unknown[], extra: object = {}) => checkRequestSchema.safeParse({ challenge, targets, ...extra }).success;

describe("checkRequestSchema", () => {
  it("accepte une demande conforme, domaine en minuscules", () => {
    const parsed = checkRequestSchema.parse({ challenge, targets: [{ service: "tentacle", scheme: "https", port: 443, host: "TV.Example.com" }] });
    expect(parsed.targets[0].host).toBe("tv.example.com");
    expect(ok([{ service: "jellyfin", scheme: "http", port: 8096 }], { jellyfinId: "c".repeat(32) })).toBe(true);
  });

  it("refuse une adresse cible, un port hors liste, trop de cibles, un champ inconnu", () => {
    expect(ok([{ service: "tentacle", scheme: "http", port: 80, host: "192.168.1.1" }])).toBe(false);
    expect(ok([{ service: "tentacle", scheme: "http", port: 22 }])).toBe(false);
    expect(ok([{ service: "tentacle", scheme: "http", port: 3000, ip: "1.2.3.4" }])).toBe(false);
    expect(ok(Array.from({ length: 5 }, () => ({ service: "tentacle", scheme: "http", port: 3000 })))).toBe(false);
    expect(ok([])).toBe(false);
    expect(checkRequestSchema.safeParse({ challenge: { id: "x", token: "y" }, targets: [{ service: "tentacle", scheme: "http", port: 3000 }] }).success).toBe(false);
  });

  it("isHostname : un nom complet, jamais une adresse", () => {
    expect(isHostname("tv.example.com")).toBe(true);
    expect(isHostname("localhost")).toBe(false);
    expect(isHostname("2001:db8::1")).toBe(false);
    expect(isHostname("a..b")).toBe(false);
  });
});
