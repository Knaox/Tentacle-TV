import { afterAll, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * L'interface web désactivable (`TENTACLE_WEB_UI=off`) : le client web répond
 * 404 une fois l'installation finie ; l'API, /tv, /.well-known et les logos
 * publics restent ; l'assistant reste tant que l'installation n'est pas
 * finie ; la commande `tentacle web` l'emporte sur la variable et la rallume.
 */
const DATA = mkdtempSync(join(tmpdir(), "tentacle-webui-"));
vi.mock("../services/dataDir", () => ({ DATA_ROOT: DATA }));

const { parseWebUiSwitch, resolveWebUi, webUiBlocks, WEB_UI_OVERRIDE_FILE, readOverrideFile } = await import("./webUi");
const { registerStaticClients } = await import("./staticClients");
const { runWebCommand } = await import("../cli/webUiCommand");

const WEB = join(DATA, "web");
const TV = join(DATA, "tv");
mkdirSync(WEB);
mkdirSync(join(WEB, "assets"));
mkdirSync(TV);
writeFileSync(join(WEB, "index.html"), "<!DOCTYPE html><title>web</title>");
writeFileSync(join(WEB, "assets", "app.js"), "1");
writeFileSync(join(WEB, "tentacle-logo-pirate.svg"), "<svg/>");
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

  it("ce qui reste servi, coupée et installée : l'API, /tv, /.well-known, les logos publics", () => {
    const off = { enabled: false, setupComplete: true };
    for (const path of ["/", "/index.html", "/assets/app.js", "/settings", "/share/abc", "/setup"]) expect(webUiBlocks(path, off)).toBe(true);
    for (const path of ["/api/config", "/api/ws", "/api", "/tv", "/tv/", "/tv/lecture/42", "/.well-known/tentacle-check/ab", "/tentacle-logo-pirate.svg"]) {
      expect(webUiBlocks(path, off)).toBe(false);
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

  it("coupée AVANT la fin de l'installation : l'assistant reste servi", async () => {
    const app = await server({ enabled: false, setupComplete: false });
    expect(await status(app, "/")).toBe(200);
    expect(await status(app, "/setup")).toBe(200);
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
