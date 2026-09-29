/**
 * Le formulaire `setup` de bout en bout, contre un faux plugin qui déclare son
 * contrat et sert sa route de test : le test joué par le serveur au nom de
 * l'administrateur, le secret enregistré complété sans redescendre, et
 * l'enregistrement — activation comprise — seulement après un test réussi.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  dir: `${process.env.TMPDIR ?? "/tmp"}/l32-setup-routes-${String(process.pid)}`,
  installed: [] as Array<Record<string, unknown>>,
  saves: 0,
}));

vi.mock("../../services/pluginManager", () => ({
  DATA_DIR: env.dir,
  isValidPluginId: (id: string) => /^[a-z0-9][a-z0-9._-]{0,63}$/.test(id),
  getInstalled: () => structuredClone(env.installed),
  saveInstalled: (next: Array<Record<string, unknown>>) => {
    env.installed = structuredClone(next);
    env.saves += 1;
  },
}));
vi.mock("../pluginRouteGuards", () => ({ isValidRouteId: (id: string) => /^[a-z0-9-]{1,64}$/.test(id) }));

import { registerPluginSetupRoutes } from "./pluginSetupRoutes";

const text = (fr: string) => ({ fr, en: fr });
const MANIFEST = {
  id: "demo",
  setup: {
    fields: [
      { key: "url", kind: "url", required: true, label: text("Adresse") },
      { key: "apiKey", kind: "secret", required: true, label: text("Clé") },
    ],
    test: "/admin/test",
    errors: { "invalid-key": text("Clé refusée") },
  },
};

const tested: Array<{ auth: unknown; body: unknown }> = [];

async function app() {
  const server = Fastify();
  // Le faux plugin : sa route de test, derrière la même authentification que le reste.
  server.post("/api/plugins/demo/admin/test", async (request, reply) => {
    tested.push({ auth: request.headers.authorization, body: request.body });
    if (request.headers.authorization !== "Bearer admin") return reply.status(401).send({ ok: false });
    const body = request.body as { url?: string; apiKey?: string };
    return body.apiKey === "bonne" ? { ok: true, version: "2.7.3" } : { ok: false, error: "invalid-key", version: "2.7.3" };
  });
  await server.register(async (admin) => registerPluginSetupRoutes(admin), { prefix: "/api/plugins" });
  return server;
}

const post = async (url: string, values: unknown) =>
  (await app()).inject({ method: "POST", url, headers: { authorization: "Bearer admin" }, payload: { values } });

beforeEach(() => {
  rmSync(env.dir, { recursive: true, force: true });
  mkdirSync(`${env.dir}/demo`, { recursive: true });
  writeFileSync(`${env.dir}/demo/plugin.json`, JSON.stringify(MANIFEST));
  env.installed = [{ id: "uuid-demo", pluginId: "demo", name: "Demo", enabled: true, config: { userLimit: 2 } }];
  env.saves = 0;
  tested.length = 0;
});

afterAll(() => {
  rmSync(env.dir, { recursive: true, force: true });
});

describe("routes setup d'un plugin", () => {
  it("GET : le formulaire, et ce qui est posé — jamais le secret", async () => {
    env.installed[0].config = { url: "http://seerr:5055", apiKey: "s3cr3t-4b1e", enabled: true };
    const res = await (await app()).inject({ method: "GET", url: "/api/plugins/demo/setup" });
    expect(res.json()).toMatchObject({ values: { url: "http://seerr:5055" }, secrets: { apiKey: true }, configured: true, enabled: true });
    expect(res.body).not.toContain("s3cr3t-4b1e");
  });

  it("test : joué par le serveur au nom de l'administrateur, rien n'est enregistré", async () => {
    const res = await post("/api/plugins/demo/setup/test", { url: "http://seerr:5055/", apiKey: "bonne" });
    expect(res.json()).toEqual({ ok: true, error: null, version: "2.7.3", saved: false });
    expect(tested).toEqual([{ auth: "Bearer admin", body: { url: "http://seerr:5055", apiKey: "bonne" } }]);
    expect(env.saves).toBe(0);
  });

  it("enregistrer : après un test réussi, les champs rangés et l'intégration activée, le reste gardé", async () => {
    const res = await post("/api/plugins/uuid-demo/setup", { url: "http://seerr:5055", apiKey: "bonne" });
    expect(res.json()).toMatchObject({ ok: true, saved: true });
    expect(env.installed[0].config).toEqual({ userLimit: 2, url: "http://seerr:5055", apiKey: "bonne", enabled: true });
  });

  it("un test raté n'enregistre rien, et rend le code du plugin", async () => {
    const res = await post("/api/plugins/demo/setup", { url: "http://seerr:5055", apiKey: "mauvaise" });
    expect(res.json()).toEqual({ ok: false, error: "invalid-key", version: "2.7.3", saved: false });
    expect(env.saves).toBe(0);
  });

  it("la clé laissée vide : le serveur complète celle qui est enregistrée", async () => {
    env.installed[0].config = { url: "http://old:5055", apiKey: "bonne", enabled: false };
    const res = await post("/api/plugins/demo/setup", { url: "http://new:5055", apiKey: "" });
    expect(res.json()).toMatchObject({ ok: true, saved: true });
    expect(tested[0].body).toEqual({ url: "http://new:5055", apiKey: "bonne" });
    expect(env.installed[0].config).toMatchObject({ url: "http://new:5055", enabled: true });
  });

  it("un champ fautif est refusé avant tout test", async () => {
    const res = await post("/api/plugins/demo/setup", { url: "seerr", apiKey: "bonne" });
    expect([res.statusCode, res.json()]).toEqual([400, { error: "invalid-field", field: "url", reason: "invalid" }]);
    expect(tested).toEqual([]);
  });

  it("module serveur pas encore chargé : la route de test manque, on le dit", async () => {
    writeFileSync(`${env.dir}/demo/plugin.json`, JSON.stringify({ ...MANIFEST, setup: { ...MANIFEST.setup, test: "/admin/absente" } }));
    const res = await post("/api/plugins/demo/setup", { url: "http://seerr:5055", apiKey: "bonne" });
    expect(res.json()).toMatchObject({ ok: false, error: "plugin-not-running", saved: false });
  });

  it("plugin inconnu, ou sans contrat : 404", async () => {
    expect((await (await app()).inject({ method: "GET", url: "/api/plugins/absent/setup" })).statusCode).toBe(404);
    writeFileSync(`${env.dir}/demo/plugin.json`, JSON.stringify({ id: "demo" }));
    const res = await (await app()).inject({ method: "GET", url: "/api/plugins/demo/setup" });
    expect([res.statusCode, res.json()]).toEqual([404, { error: "no-setup" }]);
  });
});
