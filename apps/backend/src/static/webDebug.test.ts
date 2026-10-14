import { afterAll, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Le débogage du client web (`TENTACLE_WEB_DEBUG`) : coupé par défaut ;
 * allumé, la page du web — et elle seule — porte l'attribut que le client
 * lit. Jamais `/tv`, jamais un script ajouté (la politique de sécurité de la
 * page reste celle du build), et l'interface web coupée reste coupée.
 */
vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "tentacle-webdebug-")) };
});

import { injectWebDebugFlag, resolveWebDebug, WEB_DEBUG_ATTRIBUTE } from "./webDebug";
import { registerStaticClients } from "./staticClients";
import { DATA_ROOT as DATA } from "../services/dataDir";

const CSP = `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline'">`;
const WEB_PAGE = `<!DOCTYPE html>\n<html lang="en">\n<head>${CSP}<script>var theme=1;</script></head><body><div id="root"></div></body></html>`;
const TV_PAGE = `<!DOCTYPE html><html lang="fr"><head></head><body>tv</body></html>`;
const WEB = join(DATA, "web");
const TV = join(DATA, "tv");
mkdirSync(join(WEB, "assets"), { recursive: true });
mkdirSync(TV);
writeFileSync(join(WEB, "index.html"), WEB_PAGE);
writeFileSync(join(WEB, "assets", "app.js"), "1");
writeFileSync(join(WEB, "yt-embed.html"), "<!DOCTYPE html><html><title>relais</title></html>");
writeFileSync(join(TV, "index.html"), TV_PAGE);

afterAll(() => rmSync(DATA, { recursive: true, force: true }));

const MARK = `${WEB_DEBUG_ATTRIBUTE}="on"`;
const LG = "Mozilla/5.0 (Web0S; Linux/SmartTV) WebAppManager";

describe("la règle", () => {
  it("coupé par défaut ; on, 1, true l'allument", () => {
    for (const raw of [undefined, "", "off", "0", "false", "peut-être"]) expect(resolveWebDebug({ TENTACLE_WEB_DEBUG: raw })).toBe(false);
    for (const raw of ["on", "1", "true", "ON", " true\n"]) expect(resolveWebDebug({ TENTACLE_WEB_DEBUG: raw })).toBe(true);
  });

  it("l'attribut se pose sur <html>, une fois, sans rien ajouter d'autre", () => {
    const marked = injectWebDebugFlag(WEB_PAGE);
    expect(marked).toContain(`<html ${MARK} lang="en">`);
    expect(marked.replace(` ${MARK}`, "")).toBe(WEB_PAGE);
    expect(injectWebDebugFlag(marked)).toBe(marked);
    expect(injectWebDebugFlag("<!DOCTYPE html><title>x</title>")).toBe("<!DOCTYPE html><title>x</title>");
  });
});

describe("le câblage du service", () => {
  const server = async (webDebug: boolean, webUi = { enabled: true, setupComplete: true }) => {
    const app = Fastify();
    app.get("/api/config", async () => ({ ok: true }));
    await registerStaticClients(app, { webPath: WEB, tvBuildPath: TV, webUi: () => webUi, webDebug });
    await app.ready();
    return app;
  };
  const get = async (app: Awaited<ReturnType<typeof server>>, url: string, agent?: string) =>
    app.inject({ method: "GET", url, headers: agent ? { "user-agent": agent } : {} });

  it("coupé : la page part telle que construite, à toutes ses adresses", async () => {
    const app = await server(false);
    for (const url of ["/", "/index.html", "/settings", "/share/abc"]) {
      const res = await get(app, url);
      expect([url, res.statusCode, res.body]).toEqual([url, 200, WEB_PAGE]);
    }
  });

  it("allumé : la page du web porte le drapeau — racine, index.html et routes profondes", async () => {
    const app = await server(true);
    for (const url of ["/", "/index.html", "/settings", "/share/abc", "/?debugpanel=1"]) {
      const res = await get(app, url);
      expect([url, res.statusCode, res.headers["content-type"], res.headers["cache-control"]]).toEqual([
        url, 200, "text/html; charset=utf-8", "no-cache",
      ]);
      expect(res.body).toBe(injectWebDebugFlag(WEB_PAGE));
      // Aucun validateur : la page d'avant ne revient jamais en 304.
      expect(res.headers.etag).toBeUndefined();
    }
  });

  it("allumé : aucun script ajouté, la politique de sécurité de la page intacte", async () => {
    const body = (await get(await server(true), "/")).body;
    expect(body.match(/<script/g)?.length).toBe(1);
    expect(body).toContain(CSP);
  });

  it("allumé : jamais /tv, ni les fichiers, ni l'API", async () => {
    const app = await server(true);
    for (const url of ["/tv/", "/tv/lecture/42"]) {
      const res = await get(app, url, LG);
      expect([url, res.statusCode, res.body]).toEqual([url, 200, TV_PAGE]);
    }
    expect((await get(app, "/yt-embed.html")).body).not.toContain(WEB_DEBUG_ATTRIBUTE);
    expect((await get(app, "/assets/app.js")).body).toBe("1");
    expect((await get(app, "/api/config")).json()).toEqual({ ok: true });
  });

  it("allumé, interface web coupée : toujours 404 — le drapeau n'ouvre rien", async () => {
    const app = await server(true, { enabled: false, setupComplete: true });
    for (const url of ["/", "/index.html", "/settings"]) {
      const res = await get(app, url);
      expect([url, res.statusCode, res.body]).toEqual([url, 404, ""]);
    }
    const invite = await get(app, "/register?invite=abc");
    expect(invite.statusCode).toBe(200);
    expect(invite.body).not.toContain(WEB_DEBUG_ATTRIBUTE);
  });
});
