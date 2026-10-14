import { afterAll, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * L'interface web désactivable (`TENTACLE_WEB_UI=off`) : le client web répond
 * 404 une fois l'installation finie ; l'API, /tv, /.well-known, les logos
 * publics et la page relais des bandes-annonces du bureau (`/yt-embed.html`)
 * restent ; l'assistant reste tant que l'installation n'est pas
 * finie ; la commande `tentacle web` l'emporte sur la variable et la rallume.
 */
vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "tentacle-webui-")) };
});

import { parseWebUiSwitch, readOverrideFile, resolveWebUi, webUiBlocks, WEB_UI_OVERRIDE_FILE } from "./webUi";
import { registerStaticClients } from "./staticClients";
import { runWebCommand } from "../cli/webUiCommand";
import { DATA_ROOT as DATA } from "../services/dataDir";

const WEB = join(DATA, "web");
const TV = join(DATA, "tv");
mkdirSync(WEB);
mkdirSync(join(WEB, "assets"));
mkdirSync(TV);
writeFileSync(join(WEB, "index.html"), "<!DOCTYPE html><title>web</title>");
writeFileSync(join(WEB, "assets", "app.js"), "1");
writeFileSync(join(WEB, "tentacle-logo-pirate.svg"), "<svg/>");
writeFileSync(join(WEB, "yt-embed.html"), "<!DOCTYPE html><title>relais</title>");
writeFileSync(join(TV, "index.html"), "<!DOCTYPE html><title>tv</title>");

afterAll(() => rmSync(DATA, { recursive: true, force: true }));

describe("la règle", () => {
  it("on / off et leurs variantes ; le reste ne décide rien", () => {
    for (const raw of ["off", "OFF", "false", "0", "no", "disabled", " off\n"]) expect(parseWebUiSwitch(raw)).toBe(false);
    for (const raw of ["on", "true", "1", "yes"]) expect(parseWebUiSwitch(raw)).toBe(true);
    for (const raw of [undefined, "", "peut-être"]) expect(parseWebUiSwitch(raw)).toBeNull();
  });

  it("la commande l'emporte sur la variable ; rien de réglé : allumée", () => {
    expect(resolveWebUi({}, null)).toEqual({ enabled: true, source: "default" });
    expect(resolveWebUi({ TENTACLE_WEB_UI: "off" }, null)).toEqual({ enabled: false, source: "env" });
    expect(resolveWebUi({ TENTACLE_WEB_UI: "off" }, "on\n")).toEqual({ enabled: true, source: "cli" });
    expect(resolveWebUi({ TENTACLE_WEB_UI: "on" }, "off")).toEqual({ enabled: false, source: "cli" });
  });

  it("ce qui reste servi, coupée et installée : l'API, /tv, /.well-known, les logos publics, le relais des bandes-annonces, les avatars", () => {
    const off = { enabled: false, setupComplete: true };
    for (const path of ["/", "/index.html", "/assets/app.js", "/settings", "/share/abc", "/setup", "/yt-embed.htmlx", "/yt-embed.html/", "/avatars"]) {
      expect([path, webUiBlocks(path, off)]).toEqual([path, true]);
    }
    for (const path of ["/api/config", "/api/ws", "/api", "/tv", "/tv/", "/tv/lecture/42", "/.well-known/tentacle-check/ab", "/tentacle-logo-pirate.svg", "/yt-embed.html", "/avatars/huit.webp", "/avatars/thumbs/huit.webp"]) {
      expect([path, webUiBlocks(path, off)]).toEqual([path, false]);
    }
  });

  it("l'assistant reste tant que l'installation n'est pas finie ; allumée, rien n'est refusé", () => {
    expect(webUiBlocks("/", { enabled: false, setupComplete: false })).toBe(false);
    expect(webUiBlocks("/setup", { enabled: false, setupComplete: false })).toBe(false);
    expect(webUiBlocks("/", { enabled: true, setupComplete: true })).toBe(false);
  });
});

describe("le câblage du service", () => {
  const server = async (state: { enabled: boolean; setupComplete: boolean }) => {
    const app = Fastify();
    app.get("/api/config", async () => ({ ok: true }));
    await registerStaticClients(app, { webPath: WEB, tvBuildPath: TV, webUi: () => state });
    await app.ready();
    return app;
  };
  const status = async (app: Awaited<ReturnType<typeof server>>, url: string, agent?: string) =>
    (await app.inject({ method: "GET", url, headers: agent ? { "user-agent": agent } : {} })).statusCode;

  it("coupée et installée : le web répond 404 (page, fichiers, routes profondes) ; l'API et /tv restent", async () => {
    const app = await server({ enabled: false, setupComplete: true });
    for (const url of ["/", "/assets/app.js", "/settings", "/share/xyz"]) expect([url, await status(app, url)]).toEqual([url, 404]);
    expect(await status(app, "/api/config")).toBe(200);
    expect(await status(app, "/tentacle-logo-pirate.svg")).toBe(200);
    expect(await status(app, "/tv/", "Mozilla/5.0 (Web0S; Linux/SmartTV) WebAppManager")).toBe(200);
  });

  it("coupée et installée : le bureau lit encore ses bandes-annonces — la page relais est servie, le web non", async () => {
    const app = await server({ enabled: false, setupComplete: true });
    const relay = await app.inject({ method: "GET", url: "/yt-embed.html?v=dQw4w9WgXcQ" });
    expect([relay.statusCode, relay.body]).toEqual([200, "<!DOCTYPE html><title>relais</title>"]);
    // Un chemin voisin ne passe pas par la brèche jusqu'à la page du web.
    const neighbour = await app.inject({ method: "GET", url: "/yt-embed.htmlx" });
    expect([neighbour.statusCode, neighbour.body]).toEqual([404, ""]);
  });

  it("coupée : un 404 au corps vide (la page du navigateur) ; une route d'API inconnue garde son JSON", async () => {
    const app = await server({ enabled: false, setupComplete: true });
    for (const url of ["/", "/settings"]) {
      const response = await app.inject({ method: "GET", url });
      expect([url, response.statusCode, response.body, response.headers["content-type"]]).toEqual([url, 404, "", undefined]);
    }
    const api = await app.inject({ method: "GET", url: "/api/inconnue" });
    expect([api.statusCode, api.json()]).toEqual([404, { message: "Not found" }]);
  });

  it("coupée AVANT la fin de l'installation : l'assistant reste servi", async () => {
    const app = await server({ enabled: false, setupComplete: false });
    expect(await status(app, "/")).toBe(200);
    expect(await status(app, "/setup")).toBe(200);
  });

  it("coupée et installée : le lien d'invitation mène à la page autonome du serveur, jamais en cache", async () => {
    const app = await server({ enabled: false, setupComplete: true });
    const res = await app.inject({ method: "GET", url: "/register?invite=3f2a9c01be44d7e6", headers: { "accept-language": "fr-FR,fr;q=0.9" } });
    expect([res.statusCode, res.headers["content-type"], res.headers["cache-control"], res.headers["x-robots-tag"]])
      .toEqual([200, "text/html; charset=utf-8", "no-store", "noindex, nofollow"]);
    expect(res.body).toContain('value="3f2a9c01be44d7e6"');
    expect(res.body).toContain("Rejoindre Tentacle TV");
    expect(res.body).not.toContain("<title>web</title>");
    // Le nonce de la politique est celui des scripts de la page, et change à chaque réponse.
    const nonce = /script-src 'nonce-([^']+)'/.exec(String(res.headers["content-security-policy"]))?.[1];
    expect(res.body).toContain(`<script nonce="${nonce}">`);
    const again = await app.inject({ method: "GET", url: "/register" });
    expect(again.headers["content-security-policy"]).not.toBe(res.headers["content-security-policy"]);
  });

  it("coupée et installée : rien d'autre que la page elle-même — ni ses voisins, ni un envoi", async () => {
    const app = await server({ enabled: false, setupComplete: true });
    for (const [method, url] of [["POST", "/register"], ["GET", "/register/"], ["GET", "/registerx"], ["GET", "/register/abc"]] as const) {
      const res = await app.inject({ method, url });
      expect([method, url, res.statusCode, res.body]).toEqual([method, url, 404, ""]);
    }
  });

  it("allumée, ou pendant l'installation : `/register` reste la page du client web", async () => {
    for (const state of [{ enabled: true, setupComplete: true }, { enabled: false, setupComplete: false }]) {
      const res = await (await server(state)).inject({ method: "GET", url: "/register?invite=3f2a9c01be44d7e6" });
      expect([state, res.statusCode, res.body]).toEqual([state, 200, "<!DOCTYPE html><title>web</title>"]);
    }
  });
});

describe("tentacle web on|off|default|status", () => {
  it("écrit puis efface le fichier de data/ ; la commande prime, `default` rend la main à la variable", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(runWebCommand("off", {})).toBe(0);
    expect(readFileSync(WEB_UI_OVERRIDE_FILE, "utf8").trim()).toBe("off");
    expect(resolveWebUi({ TENTACLE_WEB_UI: "on" }, readOverrideFile()).enabled).toBe(false);
    expect(runWebCommand("on", { TENTACLE_WEB_UI: "off" })).toBe(0);
    expect(resolveWebUi({ TENTACLE_WEB_UI: "off" }, readOverrideFile())).toEqual({ enabled: true, source: "cli" });
    expect(runWebCommand("default", {})).toBe(0);
    expect(existsSync(WEB_UI_OVERRIDE_FILE)).toBe(false);
    expect(runWebCommand("status", { TENTACLE_WEB_UI: "off" })).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("COUPÉE");
    log.mockRestore();
  });

  it("une autre action : l'aide, et un code d'erreur", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(runWebCommand("peut-être", {})).toBe(2);
    err.mockRestore();
  });
});
