/**
 * GET/PUT /api/preferences/hints : rien de masqué sans ligne, masquer puis
 * réafficher fait l'aller-retour (et « rien de masqué » efface la ligne), une
 * marque se retient, se remplace et s'oublie, les autres appareils du compte
 * sont prévenus — jamais l'auteur —, un rappel inconnu, un corps ou une marque
 * invalides sont refusés sans rien écrire, et une ligne illisible vaut « rien
 * de masqué ». `server_config` en Map mémoire, auth réelle contre un faux
 * /Users/Me (motif preferences.reco.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = new Map<string, string>();
const spies = vi.hoisted(() => ({ sendToUser: vi.fn() }));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({
  sendToUser: (...args: unknown[]) => spies.sendToUser(...args),
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    serverConfig: {
      findUnique: async (args: { where: { key: string } }) => {
        const value = config.get(args.where.key);
        return value === undefined ? null : { key: args.where.key, value };
      },
      upsert: async (args: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
        const value = config.has(args.where.key) ? args.update.value : args.create.value;
        config.set(args.where.key, value);
        return { key: args.where.key, value };
      },
      deleteMany: async (args: { where: { key: string } }) => ({ count: config.delete(args.where.key) ? 1 : 0 }),
    },
  }),
}));

import { dismissAccountHint, hintsConfigKey, registerHintsRoutes } from "./preferences.hints";
import { DISMISSIBLE_HINTS } from "../help/dismissibleHints";
import { requireAuth } from "../middleware/auth";

beforeEach(() => {
  config.clear();
  spies.sendToUser.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/Users/Me")) {
        return new Response(
          JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    const message = err instanceof Error ? err.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);
    registerHintsRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };

/** La réponse attendue : la liste fermée du serveur est toujours annoncée. */
function body(dismissed: string[], marks: Record<string, string> = {}) {
  return { dismissed, marks, known: [...DISMISSIBLE_HINTS] };
}

describe("GET/PUT /api/preferences/hints", () => {
  it("sans ligne : rien de masqué", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/preferences/hints", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(body([]));
    await app.close();
  });

  it("masquer puis réafficher : l'aller-retour, et la ligne disparaît quand plus rien n'est masqué", async () => {
    const app = await makeApp();
    const hidden = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true },
    });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toEqual(body(["trailerHelp"]));
    expect(config.get(hintsConfigKey("u1"))).toBe('["trailerHelp"]');
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual(body(["trailerHelp"]));

    // Masquer deux fois ne duplique rien.
    await app.inject({ method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true } });
    expect(config.get(hintsConfigKey("u1"))).toBe('["trailerHelp"]');

    const shown = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: false },
    });
    expect(shown.json()).toEqual(body([]));
    expect(config.has(hintsConfigKey("u1"))).toBe(false);
    await app.close();
  });

  it("les autres appareils du compte sont prévenus, jamais l'auteur", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true } });
    expect(spies.sendToUser).toHaveBeenCalledTimes(1);
    expect(spies.sendToUser).toHaveBeenCalledWith(
      "u1",
      { type: "preferences:update", scope: "hints" },
      { exceptTokenHash: "jeton-banc" },
    );
    await app.close();
  });

  it("un rappel inconnu ou un corps invalide : 400, rien n'est écrit, personne n'est prévenu", async () => {
    const app = await makeApp();
    const unknown = await app.inject({
      method: "PUT", url: "/api/preferences/hints/popupPublicitaire", headers, payload: { dismissed: true },
    });
    expect(unknown.statusCode).toBe(400);
    const invalid = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: "oui" },
    });
    expect(invalid.statusCode).toBe(400);
    expect(config.size).toBe(0);
    expect(spies.sendToUser).not.toHaveBeenCalled();
    await app.close();
  });

  it("une ligne illisible ou périmée vaut « rien de masqué », sans erreur", async () => {
    const app = await makeApp();
    config.set(hintsConfigKey("u1"), "{pas du json");
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json()).toEqual(body([]));
    // Un nom retiré du contrat ne ressuscite rien.
    config.set(hintsConfigKey("u1"), '["ancienRappel","trailerHelp"]');
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual(body(["trailerHelp"]));
    await app.close();
  });

  it("une marque se retient avec le masquage, se remplace, s'efface sans marque et s'oublie au réaffichage", async () => {
    const app = await makeApp();
    const put = (payload: object) =>
      app.inject({ method: "PUT", url: "/api/preferences/hints/serverUpdate", headers, payload });

    const first = await put({ dismissed: true, mark: "1.23.0" });
    expect(first.json()).toEqual(body(["serverUpdate"], { serverUpdate: "1.23.0" }));
    // L'entrée marquée est un objet : un serveur d'avant les marques l'ignore.
    expect(JSON.parse(config.get(hintsConfigKey("u1")) ?? "null")).toEqual([{ hint: "serverUpdate", mark: "1.23.0" }]);

    await app.inject({ method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true } });
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual(body(["trailerHelp", "serverUpdate"], { serverUpdate: "1.23.0" }));

    expect((await put({ dismissed: true, mark: "1.24.0" })).json())
      .toEqual(body(["trailerHelp", "serverUpdate"], { serverUpdate: "1.24.0" }));
    expect((await put({ dismissed: true })).json()).toEqual(body(["trailerHelp", "serverUpdate"]));
    await put({ dismissed: true, mark: "1.24.0" });
    expect((await put({ dismissed: false })).json()).toEqual(body(["trailerHelp"]));
    expect(config.get(hintsConfigKey("u1"))).toBe('["trailerHelp"]');
    await app.close();
  });

  it("une marque illisible est refusée (400) sans rien écrire ; une marque abîmée en base est ignorée", async () => {
    const app = await makeApp();
    for (const mark of ["", "1.2 3", "x".repeat(33), 12]) {
      const response = await app.inject({
        method: "PUT", url: "/api/preferences/hints/serverUpdate", headers, payload: { dismissed: true, mark },
      });
      expect(response.statusCode).toBe(400);
    }
    expect(config.size).toBe(0);
    expect(spies.sendToUser).not.toHaveBeenCalled();

    config.set(hintsConfigKey("u1"), '[{"hint":"serverUpdate","mark":"<script>"},{"hint":"inconnu","mark":"1.0.0"}]');
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual(body(["serverUpdate"]));
    await app.close();
  });

  it("strictement additif : un client déjà livré (mobile 1.10, bureau 1.25, Apple TV 1.10) lit et écrit comme avant", async () => {
    // La lecture d'un client livré, recopiée telle quelle : `dismissed`, filtré sur SA liste fermée.
    const shippedRead = (data: { dismissed: unknown }) => {
      const values = Array.isArray(data.dismissed) ? data.dismissed : [];
      return ["trailerHelp"].filter((hint) => values.includes(hint));
    };
    const app = await makeApp();
    await app.inject({
      method: "PUT", url: "/api/preferences/hints/serverUpdate", headers, payload: { dismissed: true, mark: "1.23.0" },
    });
    // Son geste : `{ dismissed }` seul, sans marque.
    const written = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true },
    });
    expect(written.statusCode).toBe(200);
    const read = (await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json();
    expect(read.dismissed).toEqual(["trailerHelp", "serverUpdate"]);
    expect(shippedRead(read)).toEqual(["trailerHelp"]);
    expect(shippedRead(written.json())).toEqual(["trailerHelp"]);
    // Et les noms seuls restent des chaînes en base : un serveur d'avant les relit.
    expect(JSON.parse(config.get(hintsConfigKey("u1")) ?? "null")).toEqual([
      "trailerHelp", { hint: "serverUpdate", mark: "1.23.0" },
    ]);
    await app.close();
  });

  it("sans jeton : 401", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/preferences/hints" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("dismissAccountHint (le serveur masque un rappel pour un compte)", () => {
  it("ajoute le rappel sans toucher aux autres ni à leurs marques ; deux fois, une seule entrée", async () => {
    await dismissAccountHint("u2", "tmdbKey");
    expect(config.get(hintsConfigKey("u2"))).toBe('["tmdbKey"]');
    config.set(hintsConfigKey("u3"), '[{"hint":"serverUpdate","mark":"1.23.0"},"trailerHelp"]');
    await dismissAccountHint("u3", "tmdbKey");
    await dismissAccountHint("u3", "tmdbKey");
    expect(JSON.parse(config.get(hintsConfigKey("u3")) ?? "null")).toEqual(["trailerHelp", { hint: "serverUpdate", mark: "1.23.0" }, "tmdbKey"]);
    // Masqué par le serveur, il se lit comme un « Ne plus afficher » du compte.
    expect(spies.sendToUser).not.toHaveBeenCalled();
  });
});
