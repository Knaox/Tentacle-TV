import { describe, expect, it } from "vitest";
import { ClientFetchQuota } from "./clientFetchQuota";
import { runClientFetch, type Hop, type HopRequest, type HopResult } from "./clientFetchRunner";
import { CLIENT_FETCH_LIMITS } from "./pluginClientFetch";
import { PluginManifests } from "./pluginManifests";
import { isPrivateAddress } from "./safeLookup";

const manifest = { hosts: ["music.example.com", "www.example.com"], mediaHosts: ["*.media.example.net"] };
const request = { method: "POST" as const, url: "https://music.example.com/api/search", headers: { "Content-Type": "application/json" }, body: "{\"q\":1}", timeoutMs: 2_000 };

function scripted(...results: HopResult[]): Hop & { seen: HopRequest[] } {
  const seen: HopRequest[] = [];
  const hop = async (r: HopRequest) => (seen.push(r), results.shift() ?? { kind: "failed" as const, reason: "network" as const });
  return Object.assign(hop, { seen });
}

describe("requêtes déléguées (bureau) — les adresses privées", () => {
  it("refuse réseau local, boucle, lien local, CGNAT, multidiffusion ; garde Internet", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "192.168.1.1", "172.16.5.4", "169.254.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1", "pas une ip"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["142.250.74.46", "8.8.8.8", "172.32.0.1", "2a00:1450:4007:80e::200e"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("requêtes déléguées (bureau) — l'exécution", () => {
  it("exécute une requête permise et rend statut, adresse finale, type et corps", async () => {
    const hop = scripted({ kind: "response", status: 200, contentType: "application/json", body: "{\"ok\":true}" });
    expect(await runClientFetch(request, manifest, hop)).toEqual({ ok: true, response: { status: 200, url: request.url, headers: { "content-type": "application/json" }, body: "{\"ok\":true}" } });
    expect(hop.seen[0]).toMatchObject({ method: "POST", body: "{\"q\":1}", maxBytes: CLIENT_FETCH_LIMITS.defaultMaxBytes });
  });

  it("revalide CHAQUE redirection : un hôte non déclaré arrête tout", async () => {
    const hop = scripted({ kind: "redirect", status: 302, location: "https://evil.example.org/" });
    expect(await runClientFetch(request, manifest, hop)).toEqual({ ok: false, reason: "refused" });
    const toLan = scripted({ kind: "redirect", status: 307, location: "http://192.168.1.1/" });
    expect(await runClientFetch(request, manifest, toLan)).toEqual({ ok: false, reason: "refused" });
  });

  it("suit une redirection permise ; 303 (et 302 après un POST) repart en GET sans corps", async () => {
    const hop = scripted({ kind: "redirect", status: 303, location: "/next" }, { kind: "response", status: 200, contentType: null, body: "fin" });
    const out = await runClientFetch(request, manifest, hop);
    expect(out).toEqual({ ok: true, response: { status: 200, url: "https://music.example.com/next", headers: {}, body: "fin" } });
    expect(hop.seen[1]).toMatchObject({ method: "GET", body: undefined });
    const keep = scripted({ kind: "redirect", status: 307, location: "https://www.example.com/x" }, { kind: "response", status: 200, contentType: null, body: "" });
    await runClientFetch(request, manifest, keep);
    expect(keep.seen[1]).toMatchObject({ method: "POST", body: "{\"q\":1}" });
  });

  it("trop de redirections : refusée", async () => {
    const loop = scripted(...Array.from({ length: 5 }, () => ({ kind: "redirect" as const, status: 302, location: "/again" })));
    expect(await runClientFetch(request, manifest, loop)).toEqual({ ok: false, reason: "refused" });
    expect(loop.seen.length).toBe(CLIENT_FETCH_LIMITS.maxRedirects + 1);
  });

  it("juge la requête AVANT tout envoi (hôte, en-tête interdit)", async () => {
    const hop = scripted();
    expect(await runClientFetch({ ...request, url: "https://other.example.org/" }, manifest, hop)).toEqual({ ok: false, reason: "refused" });
    expect(await runClientFetch({ ...request, headers: { Cookie: "x" } }, manifest, hop)).toEqual({ ok: false, reason: "refused" });
    expect(hop.seen).toHaveLength(0);
  });

  it("l'échec d'un saut passe tel quel (délai, taille, réseau)", async () => {
    expect(await runClientFetch(request, manifest, scripted({ kind: "failed", reason: "tooLarge" }))).toEqual({ ok: false, reason: "tooLarge" });
    expect(await runClientFetch(request, manifest, scripted({ kind: "failed", reason: "timeout" }))).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("requêtes déléguées (bureau) — le plafond par extension", () => {
  it("4 en parallèle, 30 par minute, 300 par heure", () => {
    const clock = { t: 0 };
    const quota = new ClientFetchQuota(() => clock.t);
    const held = Array.from({ length: CLIENT_FETCH_LIMITS.maxParallel }, () => quota.take("p"));
    expect(held.every(Boolean)).toBe(true);
    expect(quota.take("p")).toBeNull();
    expect(quota.take("autre")).not.toBeNull();
    held.forEach((release) => release?.());
    for (let i = held.length; i < CLIENT_FETCH_LIMITS.perMinute; i++) quota.take("p")?.();
    expect(quota.take("p")).toBeNull();
    clock.t = 61_000;
    expect(quota.take("p")).not.toBeNull();
  });
});

describe("requêtes déléguées (bureau) — le manifeste lu par le principal", () => {
  it("lit /api/plugins/active du serveur réglé, avec ses en-têtes, et garde 5 min", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const clock = { t: 0 };
    const manifests = new PluginManifests(async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify([{ pluginId: "sillon", clientFetch: manifest }, { pluginId: "vigie" }, { pluginId: "mal", clientFetch: { hosts: ["localhost"] } }]));
    }, () => clock.t);
    const session = { serverOrigin: "https://tentacle.example", headers: { Authorization: "Bearer t" } };
    expect(await manifests.of(session, "sillon")).toEqual(manifest);
    expect(await manifests.of(session, "vigie")).toBeNull();
    expect(await manifests.of(session, "mal")).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://tentacle.example/api/plugins/active");
    expect(calls[0]?.init.headers).toEqual({ Authorization: "Bearer t" });
    clock.t = 6 * 60_000;
    await manifests.of(session, "sillon");
    expect(calls).toHaveLength(2);
  });

  it("une lecture ratée ne déclare rien", async () => {
    const manifests = new PluginManifests(async () => new Response("non", { status: 500 }));
    expect(await manifests.of({ serverOrigin: "https://t.example", headers: {} }, "sillon")).toBeNull();
  });
});
