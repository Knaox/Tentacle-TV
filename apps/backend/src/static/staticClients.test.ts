import { describe, expect, it, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { registerStaticClients, type StaticClientRoots } from "./staticClients";

/**
 * Le client téléviseur n'est pas servi au web ouvert.
 *
 * Ce que ces cas vérifient est le CÂBLAGE, pas la reconnaissance d'agent —
 * `isTvUserAgent` est trivial, le hook qui l'applique ne l'est pas. Il
 * doit couvrir les trois chemins par lesquels on atteint `/tv` : un fichier
 * servi par `@fastify/static`, une route profonde qui passe par le repli
 * monopage, et l'adresse nue. Un filtre qui n'en couvrirait que le premier
 * laisserait `/tv/lecture/42` rendre l'interface de salon à un navigateur.
 *
 * Les racines servies sont des répertoires ÉPHÉMÈRES fabriqués ici : depuis
 * que les harnais ont quitté le bundle, `client/public` ne porte plus
 * d'`index.html` (seules les sondes y vivent) et `web/dist` n'existe que
 * construit — des tests assis sur l'état du poste rendaient 404 sur une copie
 * fraîche. Le câblage se prouve sur n'importe quel contenu.
 *
 * Rappel de ce que ces cas ne prouvent PAS : un `User-Agent` est écrit par le
 * client. Ceci n'est pas un contrôle d'accès, et `tvUserAgent.ts` le dit
 * lui-même. On vérifie ici qu'on ne donne pas l'adresse, pas qu'on la défend.
 */

const TV_AGENT =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/108.0.0.0 Safari/537.36 WebAppManager";
const DESKTOP_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const INITIAL_NODE_ENV = process.env.NODE_ENV;
const INITIAL_OPEN = process.env.TENTACLE_TV_OUVERT;

// Deux clients « construits » minimaux : la présence d'`index.html` est le
// témoin de build que lit le service.
const FIXTURES = mkdtempSync(join(tmpdir(), "tentacle-static-"));
const WEB_ROOT = join(FIXTURES, "web");
const TV_ROOT = join(FIXTURES, "tv");
mkdirSync(WEB_ROOT);
mkdirSync(TV_ROOT);
writeFileSync(join(WEB_ROOT, "index.html"), "<!DOCTYPE html><title>web</title>");
writeFileSync(join(TV_ROOT, "index.html"), "<!DOCTYPE html><title>tv</title>");
writeFileSync(join(TV_ROOT, "sonde.html"), "<!DOCTYPE html><title>sonde</title>");

async function server(roots: StaticClientRoots = { webPath: WEB_ROOT, tvBuildPath: TV_ROOT }) {
  const app = Fastify();
  await registerStaticClients(app, roots);
  await app.ready();
  return app;
}

beforeEach(() => {
  // La production est le seul régime où le filtre s'applique ; les deux
  // variables sont relues à chaque requête, aucun redémarrage n'est requis.
  process.env.NODE_ENV = "production";
  delete process.env.TENTACLE_TV_OUVERT;
});

afterAll(() => {
  process.env.NODE_ENV = INITIAL_NODE_ENV;
  if (INITIAL_OPEN === undefined) delete process.env.TENTACLE_TV_OUVERT;
  else process.env.TENTACLE_TV_OUVERT = INITIAL_OPEN;
  rmSync(FIXTURES, { recursive: true, force: true });
});

describe("en production, /tv n'est servi qu'à un téléviseur", () => {
  it.each([
    ["un fichier statique", "/tv/sonde.html"],
    ["une route profonde (repli monopage)", "/tv/lecture/42"],
    ["l'adresse nue", "/tv"],
    ["l'adresse avec chaîne de requête", "/tv?diagnostic=1"],
  ])("%s répond 404 à un navigateur de bureau", async (_label, path) => {
    const app = await server();
    const response = await app.inject({
      method: "GET",
      url: path,
      headers: { "user-agent": DESKTOP_AGENT },
    });
    // 404 et non 403 : l'adresse ne se confirme pas elle-même.
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("répond 404 à une requête sans agent du tout", async () => {
    const app = await server();
    const response = await app.inject({ method: "GET", url: "/tv/" });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("sert le client à un téléviseur webOS", async () => {
    const app = await server();
    const response = await app.inject({
      method: "GET",
      url: "/tv/",
      headers: { "user-agent": TV_AGENT },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("<!DOCTYPE html>");
    await app.close();
  });

  it("sert aussi une route profonde à un téléviseur", async () => {
    const app = await server();
    const response = await app.inject({
      method: "GET",
      url: "/tv/lecture/42",
      headers: { "user-agent": TV_AGENT },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("laisse le client web intact pour un navigateur de bureau", async () => {
    const app = await server();
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: { "user-agent": DESKTOP_AGENT },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("TENTACLE_TV_OUVERT=1 rouvre l'adresse, le temps d'un essai", async () => {
    process.env.TENTACLE_TV_OUVERT = "1";
    const app = await server();
    const response = await app.inject({
      method: "GET",
      url: "/tv/",
      headers: { "user-agent": DESKTOP_AGENT },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("un dist VIDE ne masque pas public — la sonde reste atteignable", async () => {
    // Mesuré le 30.08 : un `dist` laissé vide par un build interrompu prenait
    // la place de `public`, et `/tv` devenait entièrement muet, sonde
    // comprise. Le témoin d'un build est son `index.html`, pas le répertoire.
    const emptyDist = join(FIXTURES, "dist-vide");
    const probesOnly = join(FIXTURES, "public-sondes");
    mkdirSync(emptyDist, { recursive: true });
    mkdirSync(probesOnly, { recursive: true });
    writeFileSync(join(probesOnly, "sonde.html"), "<!DOCTYPE html><title>sonde</title>");

    const app = await server({
      webPath: WEB_ROOT,
      tvBuildPath: emptyDist,
      tvSourcePath: probesOnly,
    });
    const response = await app.inject({
      method: "GET",
      url: "/tv/sonde.html",
      headers: { "user-agent": TV_AGENT },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
