import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createServer as createHttpServer, type RequestListener, type Server } from "http";
import { createServer as createHttpsServer } from "https";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CheckTarget } from "./checkProtocol";
import { classifyError, probeTarget, type ProbeInput } from "./probe";

/** Des certificats jetables, faits à la volée par openssl : une autorité, un certificat qu'elle signe, un auto-signé. */
const dir = mkdtempSync(join(tmpdir(), "port-check-tls-"));
let tls: { ca: string; leaf: { key: string; cert: string }; self: { key: string; cert: string } } | null = null;

function openssl(args: string[]): void {
  execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
}

beforeAll(() => {
  try {
    openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=Tentacle Test CA",
      "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign"]);
    openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr", "-subj", "/CN=tv.test"]);
    writeFileSync(join(dir, "ext.cnf"), "subjectAltName=DNS:tv.test\nbasicConstraints=CA:FALSE\n");
    openssl(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "leaf.pem", "-days", "2", "-extfile", "ext.cnf"]);
    openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "self.key", "-out", "self.pem", "-days", "2", "-subj", "/CN=tv.test",
      "-addext", "subjectAltName=DNS:tv.test"]);
    const read = (name: string) => readFileSync(join(dir, name), "utf8");
    tls = { ca: read("ca.pem"), leaf: { key: read("leaf.key"), cert: read("leaf.pem") }, self: { key: read("self.key"), cert: read("self.pem") } };
  } catch {
    tls = null;
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

const challenge = { id: "a".repeat(32), token: "b".repeat(32) };
const input = (target: Partial<CheckTarget> & { port: number }, extra: Partial<ProbeInput> = {}): ProbeInput => ({
  sourceIp: "127.0.0.1",
  family: 4,
  challenge,
  target: { service: "tentacle", scheme: "http", ...target },
  ...extra,
});
const options = { timeoutMs: 1_000, resolve: async () => ["127.0.0.1"] };

function respond(status: number, body: string, headers: Record<string, string> = {}): RequestListener {
  return (_req, res) => {
    res.writeHead(status, headers);
    res.end(body);
  };
}

describe("probeTarget — HTTP", () => {
  it("Tentacle relit son défi : ouvert ; un autre jeton : un autre serveur", async () => {
    let path = "";
    const port = await listen(createHttpServer((req, res) => ((path = req.url ?? ""), res.end(challenge.token + "\n"))));
    expect(await probeTarget(input({ port }), options)).toEqual({ verdict: "open", httpStatus: 200, certificateExpires: null });
    expect(path).toBe(`/.well-known/tentacle-check/${challenge.id}`);
    const other = await listen(createHttpServer(respond(200, "c".repeat(32))));
    expect((await probeTarget(input({ port: other }), options)).verdict).toBe("wrong_service");
  });

  it("404 : un autre serveur ; 502 : erreur HTTP gardée", async () => {
    expect((await probeTarget(input({ port: await listen(createHttpServer(respond(404, ""))) }), options)).verdict).toBe("wrong_service");
    expect(await probeTarget(input({ port: await listen(createHttpServer(respond(502, ""))) }), options)).toMatchObject({ verdict: "http_error", httpStatus: 502 });
  });

  it("une redirection vers HTTPS est attendue ; vers HTTP, non — et rien n'est suivi", async () => {
    const toHttps = await listen(createHttpServer(respond(308, "", { location: "https://tv.test/" })));
    expect(await probeTarget(input({ port: toHttps, host: "tv.test" }), options)).toMatchObject({ verdict: "redirect", httpStatus: 308 });
    const toHttp = await listen(createHttpServer(respond(302, "", { location: "http://ailleurs.test/" })));
    expect((await probeTarget(input({ port: toHttp }), options)).verdict).toBe("http_error");
  });

  it("port fermé : refusé ; serveur muet : délai dépassé", async () => {
    const closed = await listen(createHttpServer(respond(200, "")));
    await new Promise<void>((resolve) => servers.pop()!.close(() => resolve()));
    expect((await probeTarget(input({ port: closed }), options)).verdict).toBe("refused");
    const mute = await listen(createHttpServer(() => undefined));
    expect((await probeTarget(input({ port: mute }), { ...options, timeoutMs: 300 })).verdict).toBe("timeout");
  });

  it("Jellyfin : même identifiant (tirets et casse ignorés), sinon un autre serveur", async () => {
    const body = JSON.stringify({ Id: "ABCDEF01-2345-6789-ABCD-EF0123456789", Version: "10.11.11" });
    const port = await listen(createHttpServer(respond(200, body)));
    const target = { port, service: "jellyfin" as const };
    expect((await probeTarget(input(target, { jellyfinId: "abcdef0123456789abcdef0123456789" }), options)).verdict).toBe("open");
    expect((await probeTarget(input(target, { jellyfinId: "0".repeat(32) }), options)).verdict).toBe("wrong_service");
    expect((await probeTarget(input(target), options)).verdict).toBe("open");
    const notJellyfin = await listen(createHttpServer(respond(200, "<html></html>")));
    expect((await probeTarget(input({ port: notJellyfin, service: "jellyfin" }), options)).verdict).toBe("wrong_service");
  });

  it("un corps énorme n'est lu que jusqu'à 4 Ko", async () => {
    const port = await listen(createHttpServer(respond(200, "x".repeat(200_000))));
    expect((await probeTarget(input({ port }), options)).verdict).toBe("wrong_service");
  });

  it("un domaine qui désigne une autre adresse n'est jamais suivi", async () => {
    let hits = 0;
    const port = await listen(createHttpServer((_req, res) => ((hits += 1), res.end(challenge.token))));
    expect((await probeTarget(input({ port, host: "tv.test" }), { ...options, resolve: async () => ["203.0.113.9"] })).verdict).toBe("dns_mismatch");
    expect((await probeTarget(input({ port, host: "tv.test" }), { ...options, resolve: async () => [] })).verdict).toBe("dns_error");
    const failing = async (): Promise<string[]> => {
      throw new Error("ENOTFOUND");
    };
    expect((await probeTarget(input({ port, host: "tv.test" }), { ...options, resolve: failing })).verdict).toBe("dns_error");
    expect(hits).toBe(0);
  });
});

describe("probeTarget — HTTPS", () => {
  it("certificat valide pour le domaine : ouvert, avec sa fin de validité", async (ctx) => {
    if (!tls) return ctx.skip();
    const port = await listen(createHttpsServer(tls.leaf, respond(200, challenge.token)));
    const res = await probeTarget(input({ port, scheme: "https", host: "tv.test" }), { ...options, ca: tls.ca });
    expect(res.verdict).toBe("open");
    expect(res.certificateExpires).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("autorité inconnue, auto-signé, mauvais nom", async (ctx) => {
    if (!tls) return ctx.skip();
    const leaf = await listen(createHttpsServer(tls.leaf, respond(200, challenge.token)));
    expect((await probeTarget(input({ port: leaf, scheme: "https", host: "tv.test" }), options)).verdict).toBe("tls_untrusted");
    expect((await probeTarget(input({ port: leaf, scheme: "https", host: "autre.test" }), { ...options, ca: tls.ca })).verdict).toBe("tls_name_mismatch");
    // Sans nom, l'adresse nue n'est pas couverte par le certificat.
    expect((await probeTarget(input({ port: leaf, scheme: "https" }), { ...options, ca: tls.ca })).verdict).toBe("tls_name_mismatch");
    const self = await listen(createHttpsServer(tls.self, respond(200, challenge.token)));
    expect((await probeTarget(input({ port: self, scheme: "https", host: "tv.test" }), options)).verdict).toBe("tls_self_signed");
  });
});

describe("classifyError", () => {
  it("dit chaque erreur de Node en verdict", () => {
    expect(classifyError("CERT_HAS_EXPIRED")).toBe("tls_expired");
    expect(classifyError("SELF_SIGNED_CERT_IN_CHAIN")).toBe("tls_self_signed");
    expect(classifyError("ERR_SSL_WRONG_VERSION_NUMBER")).toBe("tls_error");
    expect(classifyError("EHOSTUNREACH")).toBe("unreachable");
    expect(classifyError("ECONNRESET")).toBe("unreachable");
    expect(classifyError(undefined)).toBe("unreachable");
  });
});
