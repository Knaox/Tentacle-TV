/**
 * La vie des sessions de profil du BUREAU, par les vraies routes : la
 * déconnexion du compte sur l'appareil les coupe (et seulement là), le
 * rafraîchissement les suit, les coupures de la Famille les atteignent comme
 * sur les TV (départ d'un membre, invité supprimé, PIN changé, interrupteurs),
 * le balayage ferme un hôte abandonné, et la préférence « au lancement » est
 * celle du compte.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, resetCaches, seedUsers } from "./familyHarness";
import { buildPickerApp, door, pickSession, pickerProfiles, seedFamily, sender } from "./familyPickerHarness";
import { sweepFamily } from "../src/services/family/familySweep";
import { PICKER_HOST_IDLE_MS } from "../src/services/family/familyPickerHosts";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;
let send: ReturnType<typeof sender>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildPickerApp();
  send = sender(app);
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  h.state = freshState();
  h.fetch = fakeJellyfinUsersFetch(h.state.jf);
  resetCaches();
  tokens = seedUsers(h.state);
});

const hosts = () => h.state!.db.data.pairedDevice.filter((row) => row.platform === "desktop");
const reasons = () => h.state!.ended.map(([, reason]) => reason);

describe("la déconnexion du compte sur le bureau", () => {
  it("coupe la session de profil de CET appareil, avant la réponse — pas celle d'un autre bureau", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const laptopToken = `${tokens.damien}-portable`;
    h.state!.jf.personalTokens.set(laptopToken, IDS.damien);
    const office = await pickSession(app, tokens.damien, zoe);
    const laptop = await pickSession(app, laptopToken, IDS.lea);
    const res = await send("POST", "/api/auth/logout", tokens.damien);
    expect(res.statusCode).toBe(200);
    expect(await door(app, office)).toMatchObject({ status: 401, ended: true });
    expect(reasons()).toEqual(["unpaired"]);
    expect(hosts().map((row) => row.jellyfinUserId)).toEqual([IDS.damien]);
    expect((await door(app, laptop)).status).toBe(200);
  });

  it("le jeton personnel déconnecté n'est plus cru, et un choix qui croise la déconnexion ne laisse rien", async () => {
    const { zoe } = await seedFamily(app, tokens);
    await pickerProfiles(app, tokens.damien); // la validation du jeton est en cache
    const [picked] = await Promise.all([
      app.inject({ method: "POST", url: "/api/family/picker/sessions", headers: { authorization: `Bearer ${tokens.damien}` }, payload: { platform: "desktop", profileId: zoe } }),
      send("POST", "/api/auth/logout", tokens.damien),
    ]);
    expect((await door(app, tokens.damien)).status).toBe(401);
    const orphans = h.state!.db.data.pairedDevice.filter(
      (row) => row.parentId && !h.state!.db.data.pairedDevice.some((parent) => parent.id === row.parentId),
    );
    expect(orphans).toEqual([]);
    if (picked.statusCode === 200 && picked.json().token) expect((await door(app, picked.json().token)).ended).toBe(true);
  });

  it("la session de profil qui se déconnecte ne ferme qu'elle-même (« Changer de profil »)", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const token = await pickSession(app, tokens.damien, zoe);
    expect((await send("POST", "/api/pair/self/revoke", token)).json()).toEqual({ revoked: true });
    expect(await door(app, token)).toMatchObject({ status: 401, ended: true });
    expect(hosts()).toHaveLength(1);
    expect((await pickerProfiles(app, tokens.damien)).json().currentProfileId).toBe(IDS.damien);
  });

  it("le rafraîchissement suit la session : valable tant qu'elle dure, puis 401 profileEnded", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const token = await pickSession(app, tokens.damien, zoe);
    const alive = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { token } });
    expect(alive.statusCode).toBe(200);
    expect(alive.json()).toMatchObject({ AccessToken: token, User: { Id: zoe } });
    await send("POST", "/api/auth/logout", tokens.damien);
    const gone = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { token } });
    expect(gone.statusCode).toBe(401);
    expect(gone.json()).toMatchObject({ revoked: true, profileEnded: true });
  });
});

describe("les coupures de la Famille atteignent les bureaux", () => {
  it("un membre qui part : les autres profils quittent son bureau, le sien quitte celui des autres", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const onLea = await pickSession(app, tokens.lea, zoe);
    const leaOnDamien = await pickSession(app, tokens.damien, IDS.lea);
    const familyId = (await send("GET", "/api/family", tokens.lea)).json().family.id;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.lea)).statusCode).toBe(200);
    expect(await door(app, onLea)).toMatchObject({ status: 401, ended: true });
    expect(await door(app, leaOnDamien)).toMatchObject({ status: 401, ended: true });
    expect(reasons().sort()).toEqual(["left", "left"]);
  });

  it("un invité supprimé, un PIN changé : ses sessions de bureau tombent", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const lea = await pickSession(app, tokens.damien, IDS.lea);
    const zoeOnLea = await pickSession(app, tokens.lea, zoe);
    expect((await send("PUT", "/api/family/pin", tokens.lea, { pin: "1234" })).statusCode).toBe(200);
    expect(await door(app, lea)).toMatchObject({ status: 401, ended: true });
    expect((await send("DELETE", `/api/family/guests/${zoe}`, tokens.damien)).statusCode).toBe(200);
    expect(await door(app, zoeOnLea)).toMatchObject({ status: 401, ended: true });
    expect(reasons()).toEqual(["pin_changed", "guest_deleted"]);
  });

  it("les interrupteurs coupent ; les rallumer ne ressuscite rien", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const guest = await pickSession(app, tokens.lea, zoe);
    const member = await pickSession(app, tokens.damien, IDS.lea);
    await send("PUT", "/api/admin/family", tokens.damien, { guests: false });
    expect(await door(app, guest)).toMatchObject({ status: 401, ended: true });
    expect((await door(app, member)).status).toBe(200);
    await send("PUT", "/api/admin/family", tokens.damien, { families: false });
    expect(await door(app, member)).toMatchObject({ status: 401, ended: true });
    await send("PUT", "/api/admin/family", tokens.damien, { families: true, guests: true });
    expect((await door(app, guest)).status).toBe(401);
    expect((await door(app, member)).status).toBe(401);
  });
});

describe("le balayage et les listes d'appareils", () => {
  it("ferme l'hôte que sa session personnelle n'a plus présenté depuis trente jours", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const stale = await pickSession(app, tokens.damien, zoe);
    const fresh = await pickSession(app, tokens.lea, IDS.damien);
    const old = hosts().find((row) => row.jellyfinUserId === IDS.damien)!;
    old.lastSeen = new Date(Date.now() - PICKER_HOST_IDLE_MS - 60_000);
    await sweepFamily();
    expect(await door(app, stale)).toMatchObject({ status: 401, ended: true });
    expect((await door(app, fresh)).status).toBe(200);
    expect(hosts().map((row) => row.jellyfinUserId)).toEqual([IDS.lea]);
  });

  it("coupe une session de profil dont l'appareil n'existe plus", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const token = await pickSession(app, tokens.damien, zoe);
    const host = hosts()[0];
    h.state!.db.data.pairedDevice.splice(h.state!.db.data.pairedDevice.indexOf(host), 1);
    expect((await door(app, token)).status).toBe(200);
    await sweepFamily();
    expect(await door(app, token)).toMatchObject({ status: 401, ended: true });
    expect(reasons()).toEqual(["unpaired"]);
  });

  it("présenter la session personnelle repousse l'abandon", async () => {
    const { zoe } = await seedFamily(app, tokens);
    await pickSession(app, tokens.damien, zoe);
    const host = hosts()[0];
    host.lastSeen = new Date(Date.now() - PICKER_HOST_IDLE_MS + 60_000);
    await pickerProfiles(app, tokens.damien);
    expect((host.lastSeen as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("l'hôte d'un bureau n'est pas un appareil jumelé : ni dans « mes appareils », ni chez l'admin", async () => {
    const { zoe } = await seedFamily(app, tokens);
    await pickSession(app, tokens.damien, zoe);
    expect((await send("GET", "/api/pair/my-devices", tokens.damien)).json()).toEqual([]);
    expect((await send("GET", "/api/pair/devices", tokens.damien)).json()).toEqual([]);
    const removal = await send("DELETE", `/api/pair/my-devices/${hosts()[0].id}`, tokens.damien);
    expect(removal.statusCode).toBe(404);
  });
});

describe("la préférence « Qui regarde ? » au lancement", () => {
  it("désactivée par défaut ; celle du COMPTE, pour tous ses bureaux ; prévient ses appareils", async () => {
    await seedFamily(app, tokens);
    expect((await send("GET", "/api/family/picker/preference", tokens.damien)).json()).toEqual({ atLaunch: { desktop: false } });
    const set = await send("PUT", "/api/family/picker/preference", tokens.damien, { platform: "desktop", atLaunch: true });
    expect(set.json()).toEqual({ atLaunch: { desktop: true } });
    expect((await pickerProfiles(app, tokens.damien)).json().atLaunch).toBe(true);
    h.state!.jf.personalTokens.set(`${tokens.damien}-portable`, IDS.damien);
    expect((await pickerProfiles(app, `${tokens.damien}-portable`)).json().atLaunch).toBe(true);
    expect((await pickerProfiles(app, tokens.lea)).json().atLaunch).toBe(false);
    expect(h.state!.socket).toContainEqual({ userId: IDS.damien, msg: { type: "family:update", scope: "family" } });
    await send("PUT", "/api/family/picker/preference", tokens.damien, { platform: "desktop", atLaunch: false });
    expect(h.state!.db.data.serverConfig.filter((row) => String(row.key).startsWith("user_profile_picker_"))).toEqual([]);
  });

  it("une plateforme hors de la liste fermée : 400, rien d'écrit", async () => {
    for (const platform of ["web", "mobile", "tv", "", "__proto__"]) {
      const res = await send("PUT", "/api/family/picker/preference", tokens.damien, { platform, atLaunch: true });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("family.invalid_input");
      expect((await send("GET", `/api/family/picker/profiles?platform=${encodeURIComponent(platform)}`, tokens.damien)).statusCode).toBe(400);
    }
    expect(h.state!.db.data.serverConfig).toEqual([]);
  });
});
