import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckRequest } from "./checkProtocol";

const h = vi.hoisted(() => ({
  config: new Map<string, string>(),
  direct: { enabled: false, publicUrl: null as string | null, privateUrl: null as string | null },
  publicUrl: null as string | null,
  calls: [] as Array<{ body: CheckRequest; family: 4 | 6 }>,
  replies: {} as Record<number, unknown>,
}));

vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => h.config.get(key),
  setConfigValue: async (key: string, value: string) => void h.config.set(key, value),
  deleteConfigValue: async (key: string) => void h.config.delete(key),
  getDirectStreamingConfig: () => h.direct,
  getPublicUrl: () => h.publicUrl,
  getJellyfinUrl: () => "http://jellyfin:8096",
}));
vi.mock("../services/serverLinks/serverLinksProbe", () => ({ connectedJellyfinId: async () => "ABCDEF0123456789ABCDEF0123456789" }));
vi.mock("./checkClient", () => ({
  callCheckService: async (_url: string, body: CheckRequest, family: 4 | 6) => {
    h.calls.push({ body, family });
    return h.replies[family];
  },
}));

import { readChallenge } from "./challengeStore";
import { checkServiceUrl, runRemoteCheck } from "./remoteCheck";

const ok = (sourceIp: string, family: 4 | 6, n: number) => ({
  kind: "ok",
  response: { protocol: 1, sourceIp, family, results: Array.from({ length: n }, () => ({ verdict: "open", httpStatus: 200, certificateExpires: null })) },
});

beforeEach(() => {
  h.config.clear();
  h.direct = { enabled: false, publicUrl: null, privateUrl: null };
  h.publicUrl = null;
  h.calls = [];
  delete process.env.REMOTE_CHECK_URL;
  process.env.TENTACLE_HOST_PORT = "3471";
});
afterEach(() => {
  delete process.env.TENTACLE_HOST_PORT;
});

describe("checkServiceUrl", () => {
  it("par défaut le service public, « off » le coupe, une adresse invalide aussi", () => {
    expect(checkServiceUrl({})).toBe("https://check.tentacletv.app");
    expect(checkServiceUrl({ REMOTE_CHECK_URL: "off" })).toBeNull();
    expect(checkServiceUrl({ REMOTE_CHECK_URL: "http://127.0.0.1:3571/peu/importe" })).toBe("http://127.0.0.1:3571");
    expect(checkServiceUrl({ REMOTE_CHECK_URL: "ftp://x" })).toBeNull();
  });
});

describe("runRemoteCheck", () => {
  it("IPv4 testé, IPv6 absent du serveur : non testable, et le rapport est gardé", async () => {
    h.replies = { 4: ok("203.0.113.5", 4, 1), 6: { kind: "family_unavailable" } };
    const report = await runRemoteCheck();
    expect(report.outcome).toBe("done");
    expect(report.publicIp).toEqual({ v4: "203.0.113.5", v6: null });
    expect(report.items.map((i) => [i.family, i.port, i.verdict])).toEqual([
      [4, 3471, "open"],
      [6, 3471, "not_testable"],
    ]);
    expect(JSON.parse(h.config.get("remote_access_last_check") ?? "{}").outcome).toBe("done");
  });

  it("un défi par famille, révoqué après l'appel", async () => {
    h.replies = { 4: ok("203.0.113.5", 4, 1), 6: ok("2001:db8::5", 6, 1) };
    await runRemoteCheck();
    const [v4, v6] = h.calls;
    expect(v4.body.challenge.id).not.toBe(v6.body.challenge.id);
    expect(readChallenge(v4.body.challenge.id)).toBeNull();
    expect(readChallenge(v6.body.challenge.id)).toBeNull();
  });

  it("sans réponse en IPv4, rien n'est jugé : service indisponible, ou freiné", async () => {
    h.replies = { 4: { kind: "unavailable" }, 6: ok("2001:db8::5", 6, 1) };
    expect(await runRemoteCheck()).toMatchObject({ outcome: "service_unavailable", items: [] });
    expect(h.calls).toHaveLength(1);
    h.replies = { 4: { kind: "rate_limited" } };
    expect((await runRemoteCheck()).outcome).toBe("rate_limited");
  });

  it("service coupé : rien n'est demandé à personne", async () => {
    process.env.REMOTE_CHECK_URL = "off";
    expect((await runRemoteCheck()).outcome).toBe("service_disabled");
    expect(h.calls).toHaveLength(0);
  });

  it("Jellyfin visé par la lecture directe : son identifiant attendu part avec la demande", async () => {
    h.publicUrl = "https://tv.example.com";
    h.direct = { enabled: true, publicUrl: "https://jf.example.com", privateUrl: null };
    h.config.set("remote_access_proxy", "caddy");
    h.replies = { 4: ok("203.0.113.5", 4, 4), 6: { kind: "family_unavailable" } };
    const report = await runRemoteCheck();
    expect(h.calls[0].body.jellyfinId).toBe("abcdef0123456789abcdef0123456789");
    expect(h.calls[0].body.targets).toHaveLength(4);
    expect(report.items.filter((i) => i.family === 4).map((i) => `${i.service}:${i.scheme}:${i.port}`)).toEqual([
      "tentacle:https:443",
      "jellyfin:https:443",
      "tentacle:http:80",
      "jellyfin:http:80",
    ]);
  });
});
