import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { corsOriginsToInject, injectCorsHosts } from "./jellyfinCors";

describe("corsOriginsToInject", () => {
  it("l'origine de la page ET celle du lien public", () => {
    expect(corsOriginsToInject("http://192.168.1.20:3000", "https://tv.example.com/"))
      .toEqual(["http://192.168.1.20:3000", "https://tv.example.com"]);
  });

  it("une seule fois quand elles se confondent, sans chemin", () => {
    expect(corsOriginsToInject("https://tv.example.com", "https://tv.example.com/tentacle")).toEqual(["https://tv.example.com"]);
  });

  it("ni origine opaque, ni adresse illisible, ni rien", () => {
    expect(corsOriginsToInject("null", "pas une adresse")).toEqual([]);
    expect(corsOriginsToInject(undefined, null)).toEqual([]);
  });
});

describe("injectCorsHosts", () => {
  const calls: Array<{ method: string; body?: unknown }> = [];
  let hosts: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: init?.body ? JSON.parse(init.body) : undefined });
      if (method === "POST") {
        hosts = JSON.parse(init!.body!).CorsHosts;
        return new Response(null, { status: 204 });
      }
      return Response.json({ CorsHosts: hosts, Other: 1 });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("une liste ouverte (vide ou « * ») n'est jamais touchée : la fermer couperait tous les autres", async () => {
    for (const open of [[], ["*"], ["https://autre.example", "*"]]) {
      hosts = open;
      const result = await injectCorsHosts("http://jf", "key", ["https://tv.example.com"]);
      expect(result).toEqual({ added: [], alreadyPresent: [], open: true });
    }
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("une liste explicite reçoit nos origines manquantes — appli de bureau comprise — sans rien perdre du reste", async () => {
    hosts = ["https://tv.example.com"];
    const result = await injectCorsHosts("http://jf", "key", ["https://tv.example.com/", "http://192.168.1.20:3000/admin", "tentacle://app"]);
    expect(result).toEqual({ added: ["http://192.168.1.20:3000", "tentacle://app"], alreadyPresent: ["https://tv.example.com"], open: false });
    expect(hosts).toEqual(["https://tv.example.com", "http://192.168.1.20:3000", "tentacle://app"]);
    expect((calls.at(-1)?.body as { Other: number }).Other).toBe(1);
  });

  it("rien à ajouter : aucune écriture", async () => {
    hosts = ["https://tv.example.com", "tentacle://app"];
    await injectCorsHosts("http://jf", "key", ["https://tv.example.com", "tentacle://app", "javascript:alert(1)"]);
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });
});
