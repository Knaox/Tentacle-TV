import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DisposableJellyfin } from "./jellyfin";
import { hostCall, LanDevice } from "./lanClient";
import { REPO, Stack, waitFor } from "./stack";

/**
 * La pile Portainer de Damien, rejouée : Tentacle sur 47300, son Jellyfin
 * publié sur 47896, et à côté DEUX autres Jellyfin — un déjà configuré sur
 * 8096, un vierge sur 8097. Une base reprise d'un premier essai (pile « base »
 * reliée au Jellyfin de 8096, mêmes noms de volumes) : l'assistant doit
 * retenir le Jellyfin de SA pile, donner aux applications l'adresse publiée,
 * s'ouvrir sans code depuis le réseau local et le demander ailleurs.
 *
 *   E2E_OLD_TENTACLE_VERSION  l'image d'avant le correctif (ex. `wiz-local`) :
 *                             prouve qu'elle retenait le mauvais Jellyfin.
 */
const PORTS = { tentacle: 47300, jellyfin: 47896, discovery: 47359 };
const PROJECT = "asst-full";
const USER = "Knaoxtest";
const PASSWORD = "asst-banc-mot-de-passe";
// L'hôte « tapé dans le navigateur » : une IP privée qui n'existe pas (aucune sonde n'y aboutit).
const BROWSER_HOST = "10.255.77.10";
const OLD = process.env.E2E_OLD_TENTACLE_VERSION;
const MEDIA = join(REPO, "apps/server-e2e/.runs/asst-jellyfins");
const override = 'services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: "off"\n';
const fullEnv = (tag?: string) => ({
  TENTACLE_PORT: String(PORTS.tentacle),
  JELLYFIN_PORT: String(PORTS.jellyfin),
  JELLYFIN_DISCOVERY_PORT: String(PORTS.discovery),
  ...(tag ? { TENTACLE_VERSION: tag } : {}),
});

const configured = new DisposableJellyfin("asst-jf-configured", 8096, "12.1", MEDIA);
const blank = new DisposableJellyfin("asst-jf-blank", 8097, "12.1", MEDIA);
const owner = new LanDevice("asst-lan-owner", `${PROJECT}_default`);
const neighbour = new LanDevice("asst-lan-neighbour", `${PROJECT}_default`);
let stack: Stack;
// Le code ne sert qu'une fois : la session de la pile complète sert à tous ses tests.
let fullSession = "";

async function codeSession(s: Stack): Promise<string> {
  const reply = await hostCall(PORTS.tentacle, { path: "/session", method: "POST", host: `${BROWSER_HOST}:${PORTS.tentacle}`, body: { token: await s.setupCode() } });
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return (reply.body as { session: string }).session;
}

const context = async (session: string) =>
  (await hostCall(PORTS.tentacle, { path: "/context", host: `${BROWSER_HOST}:${PORTS.tentacle}`, session })).body as {
    jellyfin: { url: string | null; configured: boolean; claimed: boolean; clientUrl: string | null };
  };

beforeAll(async () => {
  mkdirSync(MEDIA, { recursive: true });
  await Promise.all([configured.start(), blank.start()]);
  await configured.completeStartup(USER, PASSWORD);
});

afterAll(async () => {
  await Promise.all([owner.remove(), neighbour.remove()]);
  await stack?.down();
  await Promise.all([configured.remove(), blank.remove()]);
});

describe("pile Portainer : le bon Jellyfin, la bonne adresse, sans code depuis la maison", () => {
  it("premier essai, pile « base » : sans code depuis la maison, le code ailleurs, le premier garde la place", async () => {
    stack = new Stack({ stack: "only", project: PROJECT, env: { TENTACLE_PORT: String(PORTS.tentacle) }, override });
    await stack.up();
    await Promise.all([owner.start(), neighbour.start()]);
    const host = `${await owner.address()}:3000`;

    // Depuis le Mac, colima fait passer la connexion par la passerelle de la pile : adresse inconnue → le code.
    expect((await hostCall(PORTS.tentacle, { path: "/host", host: `${BROWSER_HOST}:${PORTS.tentacle}` })).body).toMatchObject({ codeRequired: true });
    expect((await hostCall(PORTS.tentacle, { path: "/session/local", method: "POST", host: `${BROWSER_HOST}:${PORTS.tentacle}` })).body).toEqual({ error: "code_required" });
    // Un appareil de la maison, directement : rien à donner.
    expect((await owner.call({ path: "/host", host })).body).toMatchObject({ codeRequired: false });
    // Le même, par un domaine public, ou en mandataire qui transmet une adresse publique : le code.
    expect((await owner.call({ path: "/session/local", method: "POST", host: "tentacle.example.com" })).body).toEqual({ error: "code_required" });
    expect((await owner.call({ path: "/session/local", method: "POST", host, forwardedFor: "203.0.113.9" })).body).toEqual({ error: "code_required" });

    const claimed = await owner.call({ path: "/session/local", method: "POST", host });
    expect(claimed.status).toBe(200);
    const session = (claimed.body as { session: string }).session;
    expect((await owner.call({ path: "/context", host, session })).status).toBe(200);
    // Un second appareil ne prend pas la place, et la session volée ne lui sert à rien.
    expect((await neighbour.call({ path: "/session/local", method: "POST", host })).body).toEqual({ error: "setup_in_progress" });
    expect((await neighbour.call({ path: "/context", host, session })).body).toEqual({ error: "session_required" });

    // L'essai d'alors : relié au Jellyfin DÉJÀ configuré de la machine (8096), jamais fini.
    await owner.call({ path: "/jellyfin/select", method: "POST", host, session, body: { url: "http://host.docker.internal:8096" } });
    const connect = await owner.call({ path: "/jellyfin/connect", method: "POST", host, session, body: { url: "http://host.docker.internal:8096", username: USER, password: PASSWORD } });
    expect(connect.status, JSON.stringify(connect.body)).toBe(200);
    // Les « appareils » quittent le réseau de la pile : compose ne le retire pas tant qu'il sert.
    await Promise.all([owner.remove(), neighbour.remove()]);
    await stack.stop();
  });

  it.skipIf(!OLD)("l'image d'avant le correctif retenait le Jellyfin de 8096 (la cause)", async () => {
    stack = new Stack({ stack: "full", project: PROJECT, env: fullEnv(OLD), override });
    await stack.start();
    const code = await stack.setupCode();
    const reply = await fetch(stack.url("/api/setup/session"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: code }) });
    const { session } = (await reply.json()) as { session: string };
    const ctx = (await (await fetch(stack.url("/api/setup/context"), { headers: { "x-tentacle-setup": session } })).json()) as { jellyfin: { url: string; configured: boolean; claimed: boolean } };
    expect(ctx.jellyfin).toMatchObject({ url: "http://host.docker.internal:8096", configured: true, claimed: false });
    await stack.stop();
  });

  it("pile complète, base reprise : le Jellyfin étranger est oublié, celui de la pile verrouillé", async () => {
    stack = new Stack({ stack: "full", project: PROJECT, env: fullEnv(), override });
    await stack.start();
    await waitFor("le Jellyfin de la pile verrouillé", async () => (await stack.logs()).includes("Jellyfin voisin verrouillé"), 240_000, 2_000);
    expect(await stack.logs()).toContain("un Jellyfin étranger à la pile était enregistré");
    fullSession = await codeSession(stack);
    const ctx = await context(fullSession);
    expect(ctx.jellyfin).toMatchObject({ url: "http://jellyfin:8096", configured: true, claimed: true });
    // L'adresse des applications : l'hôte du navigateur et le port PUBLIÉ — jamais `http://jellyfin`, jamais 8096.
    expect(ctx.jellyfin.clientUrl).toBe(`http://${BROWSER_HOST}:${PORTS.jellyfin}`);
  });

  it("la pile propose SON Jellyfin en tête ; les autres restent visibles, et chacun est bien lui-même", async () => {
    const session = fullSession;
    const call = (url: string) => hostCall(PORTS.tentacle, { path: "/jellyfin/probe", method: "POST", host: `${BROWSER_HOST}:${PORTS.tentacle}`, session, body: { url } });
    expect((await call("http://jellyfin:8096")).body).toMatchObject({ url: "http://jellyfin:8096", inStack: true, clientUrl: `http://${BROWSER_HOST}:${PORTS.jellyfin}` });
    // Le Jellyfin de 8096, choisi exprès : c'est lui, pas celui de la pile.
    expect((await call("http://host.docker.internal:8096")).body).toMatchObject({ url: "http://host.docker.internal:8096", inStack: false, blank: false });
    const found = await hostCall(PORTS.tentacle, { path: "/jellyfin/discover", host: `${BROWSER_HOST}:${PORTS.tentacle}`, session });
    const servers = (found.body as { servers: Array<{ url: string; source: string; inStack: boolean }> }).servers;
    expect(servers[0]).toMatchObject({ url: "http://jellyfin:8096", source: "stack", inStack: true });
    expect(servers.slice(1).every((server) => !server.inStack)).toBe(true);
  });

  it("l'installation finie : le Jellyfin de la pile pris par le compte choisi, l'adresse des applications enregistrée", async () => {
    const session = fullSession;
    const at = { host: `${BROWSER_HOST}:${PORTS.tentacle}`, session };
    expect((await hostCall(PORTS.tentacle, { ...at, path: "/jellyfin/select", method: "POST", body: { url: "http://jellyfin:8096" } })).status).toBe(200);
    const init = await hostCall(PORTS.tentacle, {
      ...at, path: "/jellyfin/initialize", method: "POST",
      body: { url: "http://jellyfin:8096", username: USER, password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" },
    });
    expect(init.status, JSON.stringify(init.body)).toBe(200);
    const done = await hostCall(PORTS.tentacle, { ...at, path: "/complete", method: "POST", body: { username: USER, password: PASSWORD } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect((await stack.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_url'")).trim()).toBe("http://jellyfin:8096");
    expect((await stack.sql("SELECT value FROM server_config WHERE `key` = 'jellyfin_private_url'")).trim()).toBe(`http://${BROWSER_HOST}:${PORTS.jellyfin}`);
    // Le Jellyfin de 8096 n'a rien reçu : son compte reste le seul, aucune clé « Tentacle » n'y a été créée.
    const keys = await configured.keys(await configured.token(USER, PASSWORD));
    expect(keys.filter((k) => k.AppName === "Tentacle")).toHaveLength(1); // celle du premier essai, oubliée par la pile
    // Fini : fermé pour toujours, même pour un appareil de la maison.
    await owner.start();
    expect((await owner.call({ path: "/host", host: "10.0.0.1:3000" })).status).toBe(404);
    expect((await owner.call({ path: "/session/local", method: "POST", host: "10.0.0.1:3000" })).status).toBe(404);
  });
});
