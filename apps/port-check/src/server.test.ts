import { Writable } from "stream";
import { describe, expect, it } from "vitest";
import type { CheckTarget } from "./checkProtocol";
import { readConfig } from "./config";
import type { ProbeInput } from "./probe";
import { buildServer } from "./server";

const challenge = (n: number) => ({ id: n.toString(16).padStart(32, "0"), token: "b".repeat(32) });
const target: CheckTarget = { service: "tentacle", scheme: "http", port: 3000 };

function setup(env: NodeJS.ProcessEnv = {}) {
  const seen: ProbeInput[] = [];
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  const app = buildServer({
    config: readConfig({ CHECKS_PER_WINDOW: "3", ...env }),
    probe: async (input) => {
      seen.push(input);
      return { verdict: "open", httpStatus: 200, certificateExpires: null };
    },
    logger: { level: "info", stream, serializers: { req: (r) => ({ method: r.method, url: r.url }), res: (r) => ({ statusCode: r.statusCode }) } },
  });
  return { app, seen, lines };
}

const check = (app: ReturnType<typeof setup>["app"], payload: unknown, remoteAddress = "185.1.2.3", headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url: "/v1/check", payload: payload as object, remoteAddress, headers });

describe("POST /v1/check", () => {
  it("teste l'adresse du demandeur et rend une issue par cible", async () => {
    const { app, seen } = setup();
    const res = await check(app, { challenge: challenge(1), targets: [target, { ...target, scheme: "https", port: 443, host: "tv.example.com" }] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      protocol: 1,
      sourceIp: "185.1.2.3",
      family: 4,
      results: [
        { verdict: "open", httpStatus: 200, certificateExpires: null },
        { verdict: "open", httpStatus: 200, certificateExpires: null },
      ],
    });
    expect(seen.map((s) => s.sourceIp)).toEqual(["185.1.2.3", "185.1.2.3"]);
  });

  it("un défi rejoué est refusé", async () => {
    const { app } = setup();
    expect((await check(app, { challenge: challenge(2), targets: [target] })).statusCode).toBe(200);
    const again = await check(app, { challenge: challenge(2), targets: [target] });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: "challenge_replayed" });
  });

  it("le débit est compté par adresse (par /64 en IPv6)", async () => {
    const { app } = setup();
    for (let i = 10; i < 13; i++) expect((await check(app, { challenge: challenge(i), targets: [target] }, "2a01:e0a:1:2::5")).statusCode).toBe(200);
    const fourth = await check(app, { challenge: challenge(13), targets: [target] }, "2a01:e0a:1:2:ffff::9");
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json()).toEqual({ error: "rate_limited" });
    expect((await check(app, { challenge: challenge(14), targets: [target] }, "185.1.2.4")).statusCode).toBe(200);
  });

  it("jamais une adresse qui n'est pas publique — sauf sur un banc local", async () => {
    const res = await check(setup().app, { challenge: challenge(20), targets: [target] }, "10.0.0.5");
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "source_not_public" });
    expect((await check(setup({ ALLOW_NON_PUBLIC_SOURCES: "true" }).app, { challenge: challenge(21), targets: [target] }, "127.0.0.1")).statusCode).toBe(200);
  });

  it("X-Forwarded-For n'est cru que d'un mandataire de confiance", async () => {
    const { app, seen } = setup({ TRUSTED_PROXIES: "10.0.0.0/8" });
    await check(app, { challenge: challenge(30), targets: [target] }, "10.0.0.2", { "x-forwarded-for": "185.9.9.9" });
    expect(seen.at(-1)?.sourceIp).toBe("185.9.9.9");
    await check(app, { challenge: challenge(31), targets: [target] }, "185.1.2.3", { "x-forwarded-for": "8.8.8.8" });
    expect(seen.at(-1)?.sourceIp).toBe("185.1.2.3");
  });

  it.each([
    "pas du json",
    { challenge: challenge(40), targets: [{ ...target, port: 22 }] },
    { challenge: challenge(41), targets: [{ ...target, host: "192.168.1.1" }] },
    { challenge: challenge(42), targets: [target], ip: "1.2.3.4" },
  ])("une demande mal formée ne dit qu'un code (%#)", async (payload) => {
    const { app, seen } = setup();
    const res = await app.inject({ method: "POST", url: "/v1/check", payload: payload as string, remoteAddress: "185.1.2.3", headers: { "content-type": "application/json" } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_input" });
    expect(seen).toHaveLength(0);
  });

  it("aucune adresse dans les journaux", async () => {
    const { app, lines } = setup({ TRUSTED_PROXIES: "10.0.0.0/8" });
    await check(app, { challenge: challenge(50), targets: [target] }, "10.0.0.2", { "x-forwarded-for": "185.9.9.9" });
    await check(app, { challenge: challenge(51), targets: [target] }, "2a01:e0a:1:2::5");
    const log = lines.join("");
    expect(log).toContain("/v1/check");
    for (const ip of ["185.9.9.9", "10.0.0.2", "2a01:e0a"]) expect(log).not.toContain(ip);
  });

  it("GET /healthz répond ; le reste est 404", async () => {
    const { app } = setup();
    expect((await app.inject({ method: "GET", url: "/healthz" })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: "/v1/check" })).statusCode).toBe(404);
  });
});
