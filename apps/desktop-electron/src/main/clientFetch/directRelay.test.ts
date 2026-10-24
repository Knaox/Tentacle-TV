import { afterEach, describe, expect, it } from "vitest";
import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DirectRelay, type OpenDirect } from "./directRelay";
import { adoptDirect } from "./directSources";
import { PluginManifests } from "./pluginManifests";

const servers: Server[] = [];
const relays: DirectRelay[] = [];
afterEach(() => {
  servers.splice(0).forEach((s) => s.close());
  relays.splice(0).forEach((r) => r.close());
});

/** Un faux hôte HTTP local : `answer` décide statut et corps ; les requêtes vues sont gardées. */
async function upstream(answer: (req: IncomingMessage) => { status: number; body?: string }) {
  const seen: { url: string; headers: IncomingMessage["headers"] }[] = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url ?? "", headers: req.headers });
    const a = answer(req);
    res.writeHead(a.status, { "content-type": "audio/webm", "accept-ranges": "bytes", "set-cookie": "jamais=1" });
    res.end(a.body ?? "");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

/** Le direct « https » des tests : un faux hôte local en http. */
const openLocal: OpenDirect = (url, method, headers, onResponse) => httpRequest(url, { method, headers }, onResponse);

function get(url: string, range?: string): Promise<{ status: number; body: string; headers: IncomingMessage["headers"] }> {
  return new Promise((resolve, reject) => {
    httpRequest(url, { headers: range ? { range } : {} }, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString()));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    }).on("error", reject).end();
  });
}

describe("relais local des flux directs", () => {
  it("sert le direct SANS les en-têtes du serveur, Range transmis, en-têtes de réponse filtrés", async () => {
    const direct = await upstream(() => ({ status: 206, body: "OCTETS-DIRECTS" }));
    const server = await upstream(() => ({ status: 206, body: "SERVEUR" }));
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    const local = await relay.adopt(`${direct.url}/videoplayback?x=1`, `${server.url}/stream`, { "X-Emby-Token": "secret" });
    expect(local).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/d\/[A-Za-z0-9_-]{43}$/);
    const res = await get(local, "bytes=0-");
    expect(res).toMatchObject({ status: 206, body: "OCTETS-DIRECTS" });
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(direct.seen[0]?.headers.range).toBe("bytes=0-");
    expect(direct.seen[0]?.headers["x-emby-token"]).toBeUndefined();
    expect(server.seen).toHaveLength(0);
    expect(relay.stats).toEqual({ direct: 1, fallbacks: 0 });
  });

  it("direct refusé AVANT le premier octet : repli sur le serveur (avec ses en-têtes), puis tout du serveur", async () => {
    const direct = await upstream(() => ({ status: 403 }));
    const server = await upstream(() => ({ status: 200, body: "SERVEUR" }));
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    const local = await relay.adopt(`${direct.url}/v`, `${server.url}/stream`, { "X-Emby-Token": "secret" });
    expect(await get(local)).toMatchObject({ status: 200, body: "SERVEUR" });
    expect(server.seen[0]?.headers["x-emby-token"]).toBe("secret");
    await get(local, "bytes=10-");
    expect(direct.seen).toHaveLength(1);
    expect(server.seen[1]?.headers.range).toBe("bytes=10-");
    expect(relay.stats.fallbacks).toBe(1);
  });

  it("direct refusé APRÈS des octets servis : 502 (les deux flux peuvent différer, le moteur redemande la source)", async () => {
    let calls = 0;
    const direct = await upstream(() => (calls++ === 0 ? { status: 206, body: "DEBUT" } : { status: 403 }));
    const server = await upstream(() => ({ status: 200, body: "SERVEUR" }));
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    const local = await relay.adopt(`${direct.url}/v`, `${server.url}/s`, {});
    expect((await get(local)).body).toBe("DEBUT");
    expect((await get(local, "bytes=5-")).status).toBe(502);
    expect(server.seen).toHaveLength(0);
  });

  it("jeton inconnu : 404", async () => {
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    expect((await get(`${await relay.origin()}/d/${"a".repeat(43)}`)).status).toBe(404);
  });
});

describe("adoption d'une source directe", () => {
  const session = { serverOrigin: "https://tentacle.example", headers: { "X-Emby-Token": "t" } };
  const manifests = new PluginManifests(async () => new Response(JSON.stringify([{ pluginId: "sillon", clientFetch: { hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] } }])));
  const source = { url: "https://tentacle.example/api/plugins/sillon/music/stream/x", origin: "plugin" as const, complete: false };

  it("adoptée seulement pour un hôte déclaré par l'extension du titre, en https", async () => {
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    const ok = await adoptDirect({ ...source, direct: { url: "https://rr1.media.example.net/v?x", expiresAt: null } }, "ext:sillon:abc", session, { manifests, relay });
    expect(ok.adopted).toBe(true);
    expect(ok.source.url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect("direct" in ok.source).toBe(false);
    for (const [url, key] of [
      ["https://evil.example.org/v", "ext:sillon:abc"],
      ["http://rr1.media.example.net/v", "ext:sillon:abc"],
      ["https://rr1.media.example.net/v", "ext:autre:abc"],
      ["https://rr1.media.example.net/v", "jf:123"],
    ] as const) {
      const refused = await adoptDirect({ ...source, direct: { url, expiresAt: null } }, key, session, { manifests, relay });
      expect(refused, `${url} ${key}`).toEqual({ source, adopted: false });
    }
  });

  it("un flux déjà (presque) expiré n'est pas adopté ; sans session non plus", async () => {
    const relay = new DirectRelay(openLocal);
    relays.push(relay);
    const soon = { ...source, direct: { url: "https://rr1.media.example.net/v", expiresAt: Date.now() + 5_000 } };
    expect((await adoptDirect(soon, "ext:sillon:abc", session, { manifests, relay })).adopted).toBe(false);
    expect((await adoptDirect(soon, "ext:sillon:abc", null, { manifests, relay })).adopted).toBe(false);
  });
});
