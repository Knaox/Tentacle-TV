import { describe, expect, it, afterAll } from "vitest";
import Fastify from "fastify";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { registerStaticClients } from "./staticClients";

/**
 * Le cache du client téléviseur servi sous `/tv`.
 *
 * Les ressources de Vite sont nommées par empreinte : immuables, gardées un an.
 * `index.html` les désigne : jamais en cache, sinon la TV reste figée sur une
 * version ancienne. Depuis @fastify/static 10, `setHeaders` reçoit la réponse
 * de Fastify (plus celle de Node) : ce test tient le câblage.
 */

const TV_AGENT =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/108.0.0.0 Safari/537.36 WebAppManager";

const FIXTURES = mkdtempSync(join(tmpdir(), "tentacle-static-cache-"));
const TV_ROOT = join(FIXTURES, "tv");
mkdirSync(join(TV_ROOT, "assets"), { recursive: true });
writeFileSync(join(TV_ROOT, "index.html"), "<!DOCTYPE html><title>tv</title>");
writeFileSync(join(TV_ROOT, "assets", "index-abc123.js"), "export {};");

afterAll(() => rmSync(FIXTURES, { recursive: true, force: true }));

async function fetchTv(path: string) {
  const app = Fastify();
  await registerStaticClients(app, { webPath: join(FIXTURES, "absent"), tvBuildPath: TV_ROOT });
  await app.ready();
  const response = await app.inject({ method: "GET", url: path, headers: { "user-agent": TV_AGENT } });
  await app.close();
  return response;
}

describe("cache du client téléviseur", () => {
  it("garde une ressource à empreinte un an, immuable", async () => {
    const response = await fetchTv("/tv/assets/index-abc123.js");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("ne garde jamais index.html en cache", async () => {
    const response = await fetchTv("/tv/index.html");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-cache");
  });
});
