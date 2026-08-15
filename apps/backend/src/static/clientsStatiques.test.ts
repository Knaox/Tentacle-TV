import { describe, expect, it, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { existsSync } from "fs";
import { resolve } from "path";
import { enregistrerClientsStatiques } from "./clientsStatiques";

/**
 * Le client téléviseur n'est pas servi au web ouvert.
 *
 * Ce que ces cas vérifient est le CÂBLAGE, pas la reconnaissance d'agent —
 * `agentEstUnTeleviseur` est trivial, le hook qui l'applique ne l'est pas. Il
 * doit couvrir les trois chemins par lesquels on atteint `/tv` : un fichier
 * servi par `@fastify/static`, une route profonde qui passe par le repli
 * monopage, et l'adresse nue. Un filtre qui n'en couvrirait que le premier
 * laisserait `/tv/lecture/42` rendre l'interface de salon à un navigateur.
 *
 * Rappel de ce que ces cas ne prouvent PAS : un `User-Agent` est écrit par le
 * client. Ceci n'est pas un contrôle d'accès, et `agentTeleviseur.ts` le dit
 * lui-même. On vérifie ici qu'on ne donne pas l'adresse, pas qu'on la défend.
 */

const AGENT_TELEVISEUR =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/108.0.0.0 Safari/537.36 WebAppManager";
const AGENT_BUREAU =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const NODE_ENV_INITIAL = process.env.NODE_ENV;
const OUVERT_INITIAL = process.env.TENTACLE_TV_OUVERT;

async function serveur() {
  const app = Fastify();
  await enregistrerClientsStatiques(app);
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
  process.env.NODE_ENV = NODE_ENV_INITIAL;
  if (OUVERT_INITIAL === undefined) delete process.env.TENTACLE_TV_OUVERT;
  else process.env.TENTACLE_TV_OUVERT = OUVERT_INITIAL;
});

describe("en production, /tv n'est servi qu'à un téléviseur", () => {
  it.each([
    ["un fichier statique", "/tv/sonde.html"],
    ["une route profonde (repli monopage)", "/tv/lecture/42"],
    ["l'adresse nue", "/tv"],
    ["l'adresse avec chaîne de requête", "/tv?diagnostic=1"],
  ])("%s répond 404 à un navigateur de bureau", async (_titre, chemin) => {
    const app = await serveur();
    const reponse = await app.inject({
      method: "GET",
      url: chemin,
      headers: { "user-agent": AGENT_BUREAU },
    });
    // 404 et non 403 : l'adresse ne se confirme pas elle-même.
    expect(reponse.statusCode).toBe(404);
    await app.close();
  });

  it("répond 404 à une requête sans agent du tout", async () => {
    const app = await serveur();
    const reponse = await app.inject({ method: "GET", url: "/tv/" });
    expect(reponse.statusCode).toBe(404);
    await app.close();
  });

  it("sert le client à un téléviseur webOS", async () => {
    const app = await serveur();
    const reponse = await app.inject({
      method: "GET",
      url: "/tv/",
      headers: { "user-agent": AGENT_TELEVISEUR },
    });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toContain("<!DOCTYPE html>");
    await app.close();
  });

  it("sert aussi une route profonde à un téléviseur", async () => {
    const app = await serveur();
    const reponse = await app.inject({
      method: "GET",
      url: "/tv/lecture/42",
      headers: { "user-agent": AGENT_TELEVISEUR },
    });
    expect(reponse.statusCode).toBe(200);
    await app.close();
  });

  // Le client téléviseur est toujours servable — `client/public` est suivi par
  // git et sert de repli avant tout build. Le client web, lui, n'existe qu'une
  // fois `apps/web` construit : sur une copie fraîche, ce cas n'a rien à dire.
  it.skipIf(!existsSync(resolve(__dirname, "../../../web/dist")))(
    "laisse le client web intact pour un navigateur de bureau",
    async () => {
    const app = await serveur();
    const reponse = await app.inject({
      method: "GET",
      url: "/",
      headers: { "user-agent": AGENT_BUREAU },
    });
    expect(reponse.statusCode).toBe(200);
    await app.close();
    },
  );

  it("TENTACLE_TV_OUVERT=1 rouvre l'adresse, le temps d'un essai", async () => {
    process.env.TENTACLE_TV_OUVERT = "1";
    const app = await serveur();
    const reponse = await app.inject({
      method: "GET",
      url: "/tv/",
      headers: { "user-agent": AGENT_BUREAU },
    });
    expect(reponse.statusCode).toBe(200);
    await app.close();
  });
});
