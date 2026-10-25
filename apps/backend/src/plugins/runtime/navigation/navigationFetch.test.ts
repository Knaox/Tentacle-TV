import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "http";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createGuestNavigationFetch, parseNavigationBody } from "./navigationFetch";

let server: Server | null = null;
let folder: string | null = null;

/** Un faux invité sur une vraie socket Unix. */
async function guest(answer: (headers: IncomingHttpHeaders) => { status: number; body: string }): Promise<string> {
  folder = mkdtempSync(join(tmpdir(), "nav-"));
  const socket = join(folder, "g.sock");
  server = createServer((req, res) => {
    const { status, body } = answer(req.headers);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body);
  });
  await new Promise<void>((done) => server!.listen(socket, done));
  return socket;
}

afterEach(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  server = null;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
});

describe("lecture de la navigation sur la socket de l'invité", () => {
  it("lit la réponse du contrat, sans en-tête de compte", async () => {
    let seen: IncomingHttpHeaders = {};
    const socket = await guest((headers) => {
      seen = headers;
      return { status: 200, body: JSON.stringify({ items: [{ path: "/p", label: "Mes sons", primary: false }] }) };
    });
    const read = createGuestNavigationFetch({ socketOf: async () => socket, locale: () => "fr" });
    await expect(read("x", "/navigation")).resolves.toEqual({ items: [{ path: "/p", label: "Mes sons", primary: false }] });
    expect(seen["x-tentacle-user-id"]).toBeUndefined();
    expect(seen.authorization).toBeUndefined();
  });

  it("un refus, un corps illisible ou un invité absent : rien", async () => {
    const socket = await guest(() => ({ status: 500, body: "{}" }));
    const read = createGuestNavigationFetch({ socketOf: async () => socket, locale: () => "fr" });
    await expect(read("x", "/navigation")).resolves.toBeNull();
    const absent = createGuestNavigationFetch({ socketOf: async () => null, locale: () => "fr" });
    await expect(absent("x", "/navigation")).resolves.toBeNull();
  });
});

describe("validation de la réponse", () => {
  it("refuse le HTML, les noms trop longs, les formes inconnues", () => {
    expect(parseNavigationBody(JSON.stringify({ items: [{ path: "/p", label: "<img src=x>", primary: true }] }))).toBeNull();
    expect(parseNavigationBody(JSON.stringify({ items: [{ path: "/p", label: "a".repeat(41), primary: true }] }))).toBeNull();
    expect(parseNavigationBody(JSON.stringify({ items: [{ path: "/p", primary: "oui" }] }))).toBeNull();
    expect(parseNavigationBody("pas du json")).toBeNull();
  });
  it("garde un nom nul (libellés du manifeste)", () => {
    expect(parseNavigationBody(JSON.stringify({ items: [{ path: "/p", label: null, primary: true }] })))
      .toEqual({ items: [{ path: "/p", label: null, primary: true }] });
  });
});
