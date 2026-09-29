/**
 * Les sondes des liens du serveur, contre de vrais serveurs HTTP locaux : on
 * vérifie QUI répond — ce Tentacle-ci (son `BOOT_ID`), le Jellyfin connecté
 * (son `Id`) — et le CORS que voit un navigateur.
 */

import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOT_ID } from "../pluginRestart";
import { probeJellyfin, probeTentacle } from "./serverLinksProbe";

type Handler = (path: string, origin: string | undefined) => { status: number; body?: unknown; cors?: string };

let handler: Handler = () => ({ status: 404 });
let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const out = handler(req.url ?? "", req.headers.origin);
    if (out.cors) res.setHeader("Access-Control-Allow-Origin", out.cors);
    res.writeHead(out.status, { "Content-Type": "application/json" });
    res.end(out.body === undefined ? "" : JSON.stringify(out.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("probeTentacle", () => {
  it("reconnaît ce serveur à son BOOT_ID", async () => {
    handler = (path) => (path === "/api/health" ? { status: 200, body: { status: "ok", bootId: BOOT_ID } } : { status: 404 });
    expect((await probeTentacle(base)).result).toBe("ok");
  });

  it("un autre Tentacle répond", async () => {
    handler = () => ({ status: 200, body: { status: "ok", bootId: "autre" } });
    expect((await probeTentacle(base)).result).toBe("other-server");
  });

  it("autre chose répond", async () => {
    handler = () => ({ status: 200, body: { hello: "world" } });
    expect((await probeTentacle(base)).result).toBe("unexpected");
  });

  it("une erreur HTTP, avec son code", async () => {
    handler = () => ({ status: 502 });
    expect(await probeTentacle(base)).toMatchObject({ result: "http-error", httpStatus: 502 });
  });

  it("personne : injoignable, avec la cause", async () => {
    const probe = await probeTentacle("http://127.0.0.1:1");
    expect(probe.result).toBe("unreachable");
    expect(probe.detail).toBeTruthy();
  });
});

describe("probeJellyfin", () => {
  const info = { Id: "4b3c0e1f2a", Version: "10.11.8", ProductName: "Jellyfin Server" };

  it("le Jellyfin connecté, CORS accordé à l'origine de Tentacle", async () => {
    handler = (_path, origin) => ({ status: 200, body: info, cors: origin });
    expect(await probeJellyfin(base, { expectedId: Promise.resolve("4B3C0E1F2A"), origin: "https://tv.example.com" }))
      .toMatchObject({ result: "ok", version: "10.11.8", cors: true });
  });

  it("un autre Jellyfin", async () => {
    handler = () => ({ status: 200, body: info });
    expect((await probeJellyfin(base, { expectedId: "autre", origin: null })).result).toBe("other-server");
  });

  it("CORS absent : refusé aux navigateurs", async () => {
    handler = () => ({ status: 200, body: info });
    expect((await probeJellyfin(base, { expectedId: null, origin: "https://tv.example.com" })).cors).toBe(false);
  });

  it("sans origine, le CORS n'est pas mesuré", async () => {
    handler = () => ({ status: 200, body: info, cors: "*" });
    expect((await probeJellyfin(base, { expectedId: null, origin: null })).cors).toBeNull();
  });

  it("pas un Jellyfin", async () => {
    handler = () => ({ status: 200, body: { status: "ok" } });
    expect((await probeJellyfin(base, { expectedId: null, origin: null })).result).toBe("unexpected");
  });
});
