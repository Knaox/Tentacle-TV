/**
 * Le jumelage de bout en bout, contre un VRAI Jellyfin : chaque TV reçoit SON
 * jeton Jellyfin (Quick Connect, sur l'identifiant que le serveur dérive pour
 * elle), et le déjumelage la coupe partout — portes de Tentacle, socket, et
 * Jellyfin lui-même — sans toucher l'autre TV du compte.
 *
 * Sous la fonctionnalité « Téléviseurs jumelés » du catalogue : rien n'est
 * ajouté au manifeste publié, seuls des contrôles.
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { afterAll, expect } from "vitest";
import { check, feature } from "../harness";
import { waitUntil } from "../jellyfinHttp";
import { backendApi, ctx, expectStatus, jellyfin, okJson, proxy } from "./support";

interface Tv { jwt: string; jellyfinToken: string | null; deviceId: string | null }
interface Streaming { directStreaming: { enabled: boolean; jellyfinToken: string | null; deviceId?: string } }

const tvs: Record<string, Tv> = {};

/** Le flux « appareil » : la TV affiche un code, le compte le confirme. */
async function pairTv(name: string, owner = ctx().user): Promise<Tv> {
  const { code } = await okJson<{ code: string }>(fetch(`${ctx().backend.url}/api/pair/device/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceName: name }),
  }), "code de la TV");
  await okJson(backendApi("/api/pair/device/confirm", owner.token, { method: "POST", body: JSON.stringify({ code }) }), "confirmation");
  const status = await okJson<{ status: string; token: string }>(fetch(`${ctx().backend.url}/api/pair/device/status/${code}`), "statut");
  expect(status.status).toBe("confirmed");
  return { jwt: status.token, ...(await streaming(status.token)) };
}

async function streaming(jwt: string): Promise<Omit<Tv, "jwt">> {
  const body = await okJson<Streaming>(backendApi("/api/config/streaming?jellyfinAuth=modern", jwt), "config du direct");
  return { jellyfinToken: body.directStreaming.jellyfinToken, deviceId: body.directStreaming.deviceId ?? null };
}

const jellyfinDevices = async (): Promise<string[]> =>
  (await okJson<{ Items: Array<{ Id: string }> }>(jellyfin("/Devices", ctx().apiKey), "appareils Jellyfin")).Items.map((d) => d.Id);

/** Les portes de Tentacle, comme une TV les emprunte. */
async function doors(jwt: string): Promise<number[]> {
  const { elephants } = ctx().fixtures.movies;
  return Promise.all([
    backendApi("/api/config/streaming", jwt),
    proxy(`Items?userId=${ctx().user.id}&Recursive=true&Limit=1`, { headers: { "X-Emby-Token": jwt } }),
    proxy(`Items/${elephants}/Images/Primary?api_key=${jwt}`),
    proxy(`Videos/${elephants}/stream?static=true&ApiKey=${jwt}`, { headers: { Range: "bytes=0-1" } }),
    fetch(`${ctx().backend.url}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: jwt }) }),
  ].map((p) => p.then(async (r) => { await r.arrayBuffer(); return r.status; })));
}

/** La socket d'une TV : ce que le serveur lui dit, et comment il la ferme. */
function socket(jwt: string): Promise<{ first: Record<string, unknown>; messages: Array<Record<string, unknown>>; closed: Promise<number>; ws: WebSocket }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${ctx().backend.url.replace(/^http/, "ws")}/api/ws`);
    const messages: Array<Record<string, unknown>> = [];
    const closed = new Promise<number>((done) => ws.on("close", (c) => done(c)));
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "auth", token: jwt })));
    ws.on("message", (raw) => {
      messages.push(JSON.parse(String(raw)) as Record<string, unknown>);
      if (messages.length === 1) resolve({ first: messages[0], messages, closed, ws });
    });
  });
}

const jellyfinMe = async (token: string): Promise<number> => (await jellyfin("/Users/Me", token)).status;

/** Le réglage de Jellyfin, sur l'instance JETABLE de la suite. */
async function setQuickConnect(enabled: boolean): Promise<void> {
  const config = await okJson<Record<string, unknown>>(jellyfin("/System/Configuration", ctx().apiKey), "configuration");
  const res = await jellyfin("/System/Configuration", ctx().apiKey, {
    method: "POST", body: JSON.stringify({ ...config, QuickConnectAvailable: enabled }),
  });
  if (!res.ok) throw new Error(`Quick Connect : HTTP ${res.status}`);
}

afterAll(async () => { await setQuickConnect(true).catch(() => {}); });

feature("userdata.paired-devices", () => {
  check("chaque TV reçoit SON jeton Jellyfin, sur l'identifiant dérivé pour elle", async () => {
    tvs.salon = await pairTv("Apple TV");
    tvs.chambre = await pairTv("Android TV");
    for (const tv of [tvs.salon, tvs.chambre]) {
      expect(tv.jellyfinToken).toBeTruthy();
      expect(tv.jellyfinToken).not.toBe(ctx().user.token);
      expect(tv.deviceId).toMatch(/-paired-/);
      expect(await jellyfinMe(tv.jellyfinToken!)).toBe(200);
    }
    expect(tvs.salon.jellyfinToken).not.toBe(tvs.chambre.jellyfinToken);
    const devices = await jellyfinDevices();
    expect(devices).toContain(tvs.salon.deviceId);
    expect(devices).toContain(tvs.chambre.deviceId);
  });

  check("un jumelage d'avant reçoit son propre jeton au contact suivant, sans couper le téléphone", async () => {
    const signed = jwt.sign(
      { userId: ctx().user.id, username: ctx().user.name, isAdmin: false, deviceId: "compat-ancienne-tv", type: "paired_device" },
      ctx().backend.jwtSecret,
    );
    const prisma = new PrismaClient({ datasourceUrl: ctx().backend.databaseUrl });
    const tokenHash = createHash("sha256").update(signed).digest("hex");
    try {
      // La copie du jeton du téléphone confirmateur, comme le gravait l'ancien jumelage.
      await prisma.pairedDevice.create({ data: { name: "TV", jellyfinUserId: ctx().user.id, username: ctx().user.name, tokenHash, jellyfinAccessToken: ctx().user.token } });
      const own = await streaming(signed);
      expect(own.jellyfinToken).toBeTruthy();
      expect(own.jellyfinToken).not.toBe(ctx().user.token);
      const row = await prisma.pairedDevice.findUnique({ where: { tokenHash } });
      expect(row?.jellyfinAccessToken).toBe(own.jellyfinToken);
      expect(await jellyfinMe(ctx().user.token)).toBe(200);
      tvs.ancienne = { jwt: signed, ...own };
    } finally {
      await prisma.$disconnect();
    }
  });

  check("déjumelée par elle-même : refusée partout, jeton Jellyfin mort, l'autre TV intacte", async () => {
    const salon = await socket(tvs.salon.jwt);
    const chambre = await socket(tvs.chambre.jwt);
    expect(salon.first).toEqual({ type: "auth_ok" });
    await okJson(backendApi("/api/pair/self/revoke", tvs.salon.jwt, { method: "POST" }), "auto-révocation");
    expect(await salon.closed).toBe(4009);
    expect(salon.messages.map((m) => m.type)).toContain("session:revoked");
    for (const status of await doors(tvs.salon.jwt)) expect(status).toBe(401);
    await waitUntil(async () => (await jellyfinMe(tvs.salon.jellyfinToken!)) === 401, 15_000, "jeton Jellyfin du salon révoqué", 500);
    expect(await jellyfinDevices()).not.toContain(tvs.salon.deviceId);
    // Une TV éteinte pendant le déjumelage l'apprend en se reconnectant.
    expect((await socket(tvs.salon.jwt)).first).toEqual({ type: "auth_error", reason: "revoked" });
    // La chambre n'a rien vu.
    expect(chambre.ws.readyState).toBe(WebSocket.OPEN);
    for (const status of await doors(tvs.chambre.jwt)) expect([200, 206]).toContain(status);
    expect(await jellyfinMe(tvs.chambre.jellyfinToken!)).toBe(200);
    chambre.ws.close();
  });

  check("déjumelée depuis la liste des appareils du compte : même effet", async () => {
    const list = await okJson<Array<{ id: string; name: string }>>(backendApi("/api/pair/my-devices", ctx().user.token), "appareils du compte");
    const chambre = list.find((d) => d.name === "Android TV");
    if (!chambre) throw new Error("la chambre manque à la liste");
    expectStatus(await backendApi(`/api/pair/my-devices/${chambre.id}`, ctx().user.token, { method: "DELETE" }), 200);
    for (const status of await doors(tvs.chambre.jwt)) expect(status).toBe(401);
    await waitUntil(async () => (await jellyfinMe(tvs.chambre.jellyfinToken!)) === 401, 15_000, "jeton Jellyfin de la chambre révoqué", 500);
    // Le téléphone du compte n'a rien perdu.
    expect(await jellyfinMe(ctx().user.token)).toBe(200);
  });

  check("Quick Connect coupé : la TV jumelée lit par le proxy, sans jeton Jellyfin", async () => {
    await setQuickConnect(false);
    try {
      const tv = await pairTv("LG TV");
      expect(tv.jellyfinToken).toBeNull();
      expectStatus(await proxy(`Items?userId=${ctx().user.id}&Recursive=true&Limit=1`, { headers: { "X-Emby-Token": tv.jwt } }), 200);
    } finally {
      await setQuickConnect(true);
    }
  });
});
