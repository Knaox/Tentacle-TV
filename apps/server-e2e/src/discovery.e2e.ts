import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DisposableJellyfin } from "./jellyfin";
import { hostCall } from "./lanClient";
import { REPO, Stack } from "./stack";

/**
 * Pile « seule » (sans Jellyfin) sur une machine qui en porte deux : un déjà
 * configuré sur 8096, un vierge sur 8097. L'assistant les liste, chacun une
 * fois, le vierge d'abord, et l'adresse donnée aux applications est celle du
 * navigateur — jamais l'IP Docker de la passerelle par laquelle il les a vus.
 */
const PORT = 47301;
const USER = "Knaoxtest";
const PASSWORD = "asst-banc-mot-de-passe";
const BROWSER_HOST = "10.255.77.10";
const MEDIA = join(REPO, "apps/server-e2e/.runs/asst-jellyfins-db");
const at = { host: `${BROWSER_HOST}:${PORT}` };

const configured = new DisposableJellyfin("asst-jf-configured", 8096, "12.1", MEDIA);
const blank = new DisposableJellyfin("asst-jf-blank", 8097, "12.1", MEDIA);
const stack = new Stack({
  stack: "only",
  project: "asst-db",
  env: { TENTACLE_PORT: String(PORT) },
  override: 'services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: "off"\n',
});

interface Found {
  url: string;
  blank: boolean;
  serverName: string;
  clientUrl: string | null;
  source: string;
}

let session = "";

beforeAll(async () => {
  mkdirSync(MEDIA, { recursive: true });
  await Promise.all([configured.start(), blank.start(), stack.up()]);
  await configured.completeStartup(USER, PASSWORD);
  const reply = await hostCall(PORT, { ...at, path: "/session", method: "POST", body: { token: await stack.setupCode() } });
  session = (reply.body as { session: string }).session;
});

afterAll(async () => {
  await stack.down();
  await Promise.all([configured.remove(), blank.remove()]);
});

describe("pile sans Jellyfin : la liste des Jellyfin joignables", () => {
  let servers: Found[] = [];

  it("chacun une fois, le vierge d'abord, la note du pont Docker", async () => {
    const reply = await hostCall(PORT, { ...at, path: "/jellyfin/discover", session });
    expect(reply.status, JSON.stringify(reply.body)).toBe(200);
    const body = reply.body as { servers: Found[]; udp: string; bridged: boolean };
    servers = body.servers;
    // La liste telle que l'assistant la reçoit, gardée dans la sortie du banc.
    console.info(JSON.stringify({ udp: body.udp, bridged: body.bridged, servers: servers.map(({ url, blank, source, clientUrl }) => ({ url, blank, source, clientUrl })) }));
    const ports = servers.map((s) => new URL(s.url).port);
    expect(ports).toContain("8096");
    expect(ports).toContain("8097");
    expect(new Set(ports).size).toBe(ports.length);
    expect(servers[0]).toMatchObject({ blank: true });
    expect(new URL(servers[0].url).port).toBe("8097");
    expect(servers.find((s) => s.url.endsWith(":8096"))).toMatchObject({ blank: false });
    expect(body.bridged).toBe(true);
  });

  it("l'adresse des applications : l'hôte du navigateur, jamais l'IP de la passerelle Docker", () => {
    expect(servers[0].clientUrl).toBe(`http://${BROWSER_HOST}:8097`);
  });

  it("le vierge choisi est configuré ; le Jellyfin déjà configuré n'a rien reçu", async () => {
    const url = servers[0].url;
    // Le choix d'abord : sans lui, le serveur refuse de configurer quoi que ce soit.
    const chosen = await hostCall(PORT, { ...at, session, path: "/jellyfin/select", method: "POST", body: { url } });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    const init = await hostCall(PORT, {
      ...at, session, path: "/jellyfin/initialize", method: "POST",
      body: { url, username: USER, password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" },
    });
    expect(init.status, JSON.stringify(init.body)).toBe(200);
    const done = await hostCall(PORT, { ...at, session, path: "/complete", method: "POST", body: { username: USER, password: PASSWORD } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect((await stack.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_url'")).trim()).toBe(url);
    expect((await stack.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_private_url'")).trim()).toBe(`http://${BROWSER_HOST}:8097`);
    const keys = await configured.keys(await configured.token(USER, PASSWORD));
    expect(keys.filter((k) => k.AppName === "Tentacle")).toHaveLength(0);
  });
});
