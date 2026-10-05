import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import { callCheckService, isFamilyError } from "./checkClient";
import type { CheckRequest } from "./checkProtocol";

const body: CheckRequest = { challenge: { id: "a".repeat(32), token: "b".repeat(32) }, targets: [{ service: "tentacle", scheme: "http", port: 3000 }] };
let server: Server | null = null;

async function fakeService(status: number, reply: unknown, host = "127.0.0.1"): Promise<string> {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const received = JSON.parse(raw) as CheckRequest;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(typeof reply === "function" ? (reply as (r: CheckRequest) => unknown)(received) : reply));
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, host, resolve));
  const { port } = server.address() as AddressInfo;
  return `http://localhost:${port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("callCheckService", () => {
  it("une réponse conforme, dans la famille demandée", async () => {
    const url = await fakeService(200, (r: CheckRequest) => ({
      protocol: 1,
      sourceIp: "203.0.113.5",
      family: 4,
      results: r.targets.map(() => ({ verdict: "open", httpStatus: 200, certificateExpires: null })),
    }));
    const call = await callCheckService(url, body, 4);
    expect(call).toEqual({ kind: "ok", response: { protocol: 1, sourceIp: "203.0.113.5", family: 4, results: [{ verdict: "open", httpStatus: 200, certificateExpires: null }] } });
  });

  it("une réponse non conforme ne passe pas : service indisponible", async () => {
    const url = await fakeService(200, { protocol: 1, sourceIp: "pas une ip", family: 4, results: [] });
    expect((await callCheckService(url, body, 4)).kind).toBe("unavailable");
  });

  it("429 : freiné ; 409 : refusé ; 500 : indisponible", async () => {
    expect((await callCheckService(await fakeService(429, { error: "rate_limited" }), body, 4)).kind).toBe("rate_limited");
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    expect((await callCheckService(await fakeService(409, { error: "challenge_replayed" }), body, 4)).kind).toBe("rejected");
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    expect((await callCheckService(await fakeService(500, {}), body, 4)).kind).toBe("unavailable");
  });

  it("un service qui n'existe pas : indisponible en IPv4", async () => {
    expect((await callCheckService("http://127.0.0.1:1", body, 4)).kind).toBe("unavailable");
  });

  it("une famille absente (pas de route, pas d'adresse) se reconnaît à son erreur", () => {
    for (const code of ["ENETUNREACH", "EHOSTUNREACH", "EADDRNOTAVAIL", "ENOTFOUND", "EAI_ADDRFAMILY"]) expect(isFamilyError(code)).toBe(true);
    for (const code of ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", undefined]) expect(isFamilyError(code)).toBe(false);
  });
});
