import { describe, expect, it } from "vitest";
import { HOST_PARAM_SCHEMAS } from "../hostSchemas";

/** `client.fetch` : la nature d'une requête (geste ou fond) passe la porte de l'hôte ; rien d'autre de nouveau. */

const base = { client: "p".repeat(32), request: { method: "POST", url: "https://music.youtube.com/youtubei/v1/player", body: "{}" } };

describe("schéma de `client.fetch`", () => {
  it("accepte `kind` play ou prefetch, et son absence", () => {
    const schema = HOST_PARAM_SCHEMAS["client.fetch"];
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, request: { ...base.request, kind: "play" } }).success).toBe(true);
    expect(schema.safeParse({ ...base, request: { ...base.request, kind: "prefetch" } }).success).toBe(true);
    expect(schema.safeParse({ ...base, request: { ...base.request, kind: "autre" } }).success).toBe(false);
    expect(schema.safeParse({ ...base, request: { ...base.request, cookie: "x" } }).success).toBe(false);
  });
});
