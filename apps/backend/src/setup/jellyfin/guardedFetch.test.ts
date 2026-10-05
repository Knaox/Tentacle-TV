import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";
import { configureJellyfinGuard, jellyfinRequest, networkErrorCode } from "./guardedFetch";

let jf: FakeJellyfin;
beforeAll(async () => {
  jf = await startFakeJellyfin();
});
afterAll(() => jf.close());
beforeEach(() => configureJellyfinGuard({ allowLoopback: true }));

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

describe("transport gardé vers Jellyfin", () => {
  it("lit un JSON 2xx, et rien d'autre", async () => {
    jf.on("GET /ok", { status: 200, json: { a: 1 } });
    jf.on("GET /texte", { status: 200, raw: "<html>", headers: { "Content-Type": "text/html" } });
    jf.on("GET /refus", { status: 401, json: { secret: "rien ne remonte" } });
    expect(await jellyfinRequest(jf.url, "/ok")).toMatchObject({ status: 200, json: { a: 1 } });
    expect(await jellyfinRequest(jf.url, "/texte")).toMatchObject({ status: 200, json: null });
    expect(await jellyfinRequest(jf.url, "/refus")).toMatchObject({ status: 401, json: null });
  });

  it("une réponse trop grosse n'est pas un Jellyfin", async () => {
    jf.on("GET /enorme", { status: 200, json: { x: "a".repeat(5000) } });
    expect(await codeOf(jellyfinRequest(jf.url, "/enorme", { maxBytes: 1000 }))).toBe("jf_not_jellyfin");
  });

  it("ne suit jamais une redirection : l'adresse d'arrivée est seulement rapportée", async () => {
    jf.on("GET /ailleurs", { status: 302, headers: { Location: "http://169.254.169.254/latest/meta-data" } });
    const reply = await jellyfinRequest(jf.url, "/ailleurs");
    expect(reply).toMatchObject({ status: 302, location: "http://169.254.169.254/latest/meta-data" });
    expect(jf.calls("GET /latest/meta-data")).toHaveLength(0);
  });

  it("délai dépassé, port fermé : deux causes distinctes", async () => {
    jf.on("GET /lent", { status: 200, hang: true });
    expect(await codeOf(jellyfinRequest(jf.url, "/lent", { timeoutMs: 200 }))).toBe("jf_timeout");
    const closed: Server = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    expect(await codeOf(jellyfinRequest(`http://127.0.0.1:${port}`, "/x"))).toBe("jf_unreachable");
  });

  it("métadonnées des clouds refusées avant toute connexion", async () => {
    expect(await codeOf(jellyfinRequest("http://169.254.169.254", "/latest/meta-data", { timeoutMs: 2_000 }))).toBe("jf_forbidden_address");
    expect(await codeOf(jellyfinRequest("http://[fe80::1]:8096", "/x", { timeoutMs: 2_000 }))).toBe("jf_forbidden_address");
  });

  it("dans Docker, la machine elle-même est refusée — en IP comme par son nom", async () => {
    configureJellyfinGuard({ allowLoopback: false });
    expect(await codeOf(jellyfinRequest(jf.url, "/ok"))).toBe("jf_localhost_in_docker");
    const port = new URL(jf.url).port;
    expect(await codeOf(jellyfinRequest(`http://localhost:${port}`, "/ok"))).toBe("jf_localhost_in_docker");
    expect(jf.calls("GET /ok").length).toBe(1);
  });

  it("dit les certificats refusés à part", () => {
    expect(networkErrorCode(Object.assign(new TypeError("fetch failed"), { cause: { code: "DEPTH_ZERO_SELF_SIGNED_CERT" } }))).toBe("jf_tls_invalid");
    expect(networkErrorCode(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }))).toBe("jf_unreachable");
  });
});
