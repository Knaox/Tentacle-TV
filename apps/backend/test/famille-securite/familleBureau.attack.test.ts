/**
 * Tests d'attaque — « Qui regarde ? » sur le BUREAU (SEC-F-46..53, exigences de
 * l'agent E, lot du 14/10). Vraies routes, base en mémoire, faux Jellyfin.
 *
 * Ce qu'on attaque : la porte du choix (`/api/family/picker/*`), réservée à la
 * session PERSONNELLE ; la session de profil qu'elle délivre (elle regarde,
 * n'administre rien, n'ouvre aucun autre profil, ne s'inscrit nulle part) ;
 * l'appareil qu'elle vise (dérivé du jeton personnel, jamais du corps) ; le PIN
 * (compteur des TV) ; le compte de démonstration ; l'invité.
 * Le proxy Jellyfin : `familleBureauProxy.attack.test.ts`.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("../familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../../src/services/configStore", async () => (await import("../familyMocks")).configStoreMock(() => h.state!));
vi.mock("../../src/services/db", async () => (await import("../familyMocks")).dbMock(() => h.state!));
vi.mock("../../src/services/wsManager", async () => (await import("../familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../../src/services/pushService", async () => (await import("../familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../../src/services/deviceSessions/deviceAuth", async () => (await import("../familyMocks")).deviceAuthMock());
vi.mock("../../src/services/deviceSessions/gateway", async () => (await import("../familyMocks")).gatewayMock());

import { freshState } from "../familyMocks";
import { fakeJellyfinUsersFetch } from "../fakeJellyfinUsers";
import { IDS, enroll, openProfile, pairTv, resetCaches, seedUsers } from "../familyHarness";
import { buildPickerApp, door, pick, pickSession, pickerProfiles, seedFamily, sender } from "../familyPickerHarness";
import { signImpersonationToken } from "../../src/services/jwt";
import { requireAdmin, requirePersonalAdmin } from "../../src/middleware/auth";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;
let send: ReturnType<typeof sender>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildPickerApp(async (instance) => {
    // Des portes témoins d'administration : `requireAdmin`, et la session personnelle d'un administrateur.
    instance.get("/api/admin/witness", { preHandler: [requireAdmin] }, async () => ({ ok: true }));
    instance.get("/api/admin/witness-personal", { preHandler: [requirePersonalAdmin] }, async () => ({ ok: true }));
  });
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

const PICKER_CALLS: Array<[string, "GET" | "POST" | "PUT", string, unknown?]> = [
  ["la liste", "GET", "/api/family/picker/profiles?platform=desktop"],
  ["le choix", "POST", "/api/family/picker/sessions", { platform: "desktop", profileId: IDS.damien }],
  ["la préférence (lecture)", "GET", "/api/family/picker/preference"],
  ["la préférence (écriture)", "PUT", "/api/family/picker/preference", { platform: "desktop", atLaunch: true }],
];
const rows = () => h.state!.db.data.pairedDevice.length;

describe("SEC-F-46 : la porte du choix n'accepte qu'une VRAIE session personnelle", () => {
  it.each(PICKER_CALLS)("%s : une session de profil (bureau ou TV) → 403, rien d'émis", async (_name, method, url, payload) => {
    const { zoe } = await seedFamily(app, tokens);
    const desktopProfile = await pickSession(app, tokens.damien, zoe);
    const tv = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const tvProfile = (await openProfile(app, tv, { profileId: IDS.damien })).json().token as string;
    const before = rows();
    for (const token of [desktopProfile, tvProfile]) {
      const res = await send(method, url, token, payload);
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("family.personal_session_required");
    }
    expect(rows()).toBe(before);
    expect(h.state!.db.data.serverConfig).toEqual([]);
  });

  it.each(PICKER_CALLS)("%s : un jeton de TV, « voir en tant que », ou rien → refusé", async (_name, method, url, payload) => {
    const legacy = await pairTv(h.state!, IDS.damien, "Damien");
    const legacyStatus = (await send(method, url, legacy, payload)).statusCode;
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien", "Chambre"));
    expect((await send(method, url, pairing, payload)).statusCode).toBe(401);
    const impersonation = await signImpersonationToken({ userId: IDS.lea, username: "Léa", adminUserId: IDS.damien, adminUsername: "Damien" });
    const asLea = await send(method, url, impersonation, payload);
    expect(asLea.statusCode).toBe(403);
    expect(asLea.json().code).toBe("family.personal_session_required");
    expect((await app.inject({ method, url, ...(payload !== undefined && { payload: payload as object }) })).statusCode).toBe(401);
    expect(legacyStatus).toBe(403);
    expect(h.state!.db.data.pairedDevice.filter((row) => row.platform)).toEqual([]);
  });
});

describe("SEC-F-46/47 : la session de profil du bureau regarde, et rien d'autre", () => {
  it("n'atteint AUCUNE route de la Famille : ni la famille, ni un PIN, ni la gestion, ni un autre profil", async () => {
    const { zoe } = await seedFamily(app, tokens);
    // Le profil de Damien (sans PIN) ouvert sur le bureau de Léa : celui du propriétaire.
    const owner = await pickSession(app, tokens.lea, IDS.damien);
    const attempts: Array<["GET" | "POST" | "PUT" | "DELETE", string, unknown?]> = [
      ["GET", "/api/family"],
      ["PUT", "/api/family/pin", { pin: "0000" }],
      ["POST", "/api/family/tv/manage/unlock", {}],
      ["POST", "/api/family/guests", { name: "Intrus", color: "red" }],
      ["DELETE", `/api/family/guests/${zoe}`],
      ["DELETE", `/api/family/members/${IDS.lea}`],
      ["POST", "/api/family/invitations", { userId: IDS.hugo }],
      ["GET", "/api/family/candidates"],
      ["DELETE", "/api/family", { confirm: "dissolve" }],
      ["POST", "/api/family/tv/sessions", { profileId: zoe }],
      ["GET", "/api/family/tv/profiles"],
    ];
    for (const [method, url, payload] of attempts) {
      const res = await send(method, url, owner, payload);
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().code, `${method} ${url}`).toBe("family.personal_session_required");
    }
    expect(h.state!.jf.users.size).toBe(7);
    expect((await door(app, owner)).status).toBe(200);
  });

  it("ne s'inscrit nulle part comme appareil, n'administre rien, ne touche à aucun compte", async () => {
    await seedFamily(app, tokens);
    const owner = await pickSession(app, tokens.lea, IDS.damien);
    const enrollRes = await send("POST", "/api/family/tv/enroll", owner);
    expect(enrollRes.statusCode).toBe(403);
    for (const url of ["/api/pair/my-devices", "/api/push/register", "/api/downloads/capabilities"]) {
      const res = await send("GET", url, owner);
      expect(res.statusCode, url).toBe(403);
      expect(res.json().code, url).toBe("family.personal_session_required");
    }
    expect((await send("GET", "/api/admin/family", owner)).statusCode).toBe(403);
    expect((await send("PUT", "/api/admin/family", owner, { families: false })).statusCode).toBe(403);
    // Damien est administrateur de Jellyfin : son profil, ouvert sur un bureau, ne l'est pas.
    expect((await send("GET", "/api/admin/witness", tokens.damien)).statusCode).toBe(200);
    expect((await send("GET", "/api/admin/witness", owner)).statusCode).toBe(403);
    expect((await send("GET", "/api/admin/witness-personal", owner)).statusCode).toBe(403);
    expect((await door(app, owner)).user).toMatchObject({ userId: IDS.damien, isAdmin: false });
  });

  it("un invité choisi sur le bureau garde ses limites : ni Watch Together, ni tickets, ni extensions", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const guest = await pickSession(app, tokens.damien, zoe);
    for (const url of ["/api/watch-together/group", "/api/tickets/mine", "/api/plugins/seer/requests"]) {
      const res = await send("GET", url, guest);
      expect(res.statusCode, url).toBe(403);
      expect(res.json().code, url).toBe("family.guest_account");
    }
  });
});

describe("SEC-F-47 : borné à SA famille, l'appareil dérivé du jeton personnel", () => {
  it("un compte hors famille n'ouvre aucun profil de la famille, même en glissant des identifiants", async () => {
    const { zoe } = await seedFamily(app, tokens);
    for (const profileId of [zoe, IDS.damien, IDS.lea]) {
      const res = await pick(app, tokens.hugo, { profileId, ...({ userId: IDS.damien, ownerUserId: IDS.damien } as object) });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("family.profile_unavailable");
    }
    expect(h.state!.db.data.pairedDevice).toEqual([]);
  });

  it("aucun geste d'un autre compte ne ferme la session de profil de cet appareil", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const guestOnDamien = await pickSession(app, tokens.damien, zoe);
    // Léa (membre) choisit, revient, se déconnecte ; Hugo aussi : rien ne vise l'appareil de Damien.
    await pickSession(app, tokens.lea, zoe);
    await pick(app, tokens.lea, { profileId: IDS.lea, deviceName: "Desktop" });
    await send("POST", "/api/auth/logout", tokens.lea);
    await pick(app, tokens.hugo, { profileId: IDS.hugo });
    await send("POST", "/api/auth/logout", tokens.hugo);
    expect((await door(app, guestOnDamien)).status).toBe(200);
  });
});

describe("SEC-F-48/51 : le PIN, jugé par le serveur au compteur des TV ; SON profil ne frappe rien", () => {
  it("cinq essais ratés bloquent, même le bon PIN ; ni le PIN ni son empreinte ne sortent", async () => {
    expect((await send("PUT", "/api/family/pin", tokens.damien, { pin: "4321" })).statusCode).toBe(200);
    const bodies: string[] = [];
    for (let i = 0; i < 5; i++) bodies.push((await pick(app, tokens.damien, { profileId: IDS.damien, pin: `000${i}` })).body);
    const locked = await pick(app, tokens.damien, { profileId: IDS.damien, pin: "4321" });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().code).toBe("family.pin_locked");
    bodies.push(locked.body, (await pickerProfiles(app, tokens.damien)).body);
    for (const body of bodies) expect(body).not.toMatch(/4321|scrypt|pinHash/);
  });

  it("SON profil : PIN vérifié, aucun jeton, aucune session, aucun appareil chez Jellyfin", async () => {
    await seedFamily(app, tokens);
    const devicesBefore = h.state!.jf.devices.size;
    const res = await pick(app, tokens.damien, { profileId: IDS.damien });
    expect(res.json()).toEqual({ personal: true, profile: expect.objectContaining({ personal: true }) });
    expect(h.state!.db.data.pairedDevice).toEqual([]);
    expect(h.state!.jf.devices.size).toBe(devicesBefore);
  });
});

describe("SEC-F-28 / 52 : le compte de démonstration et la préférence", () => {
  it("le compte de démonstration n'ouvre que le sien et ne règle rien", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { jellyfinUserId: IDS.demo, code: "x" } });
    expect((await pickerProfiles(app, tokens.demo)).json().profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.demo]);
    expect((await pick(app, tokens.demo, { profileId: IDS.demo })).json().personal).toBe(true);
    expect((await pick(app, tokens.demo, { profileId: IDS.damien })).json().code).toBe("family.review_account");
    const pref = await send("PUT", "/api/family/picker/preference", tokens.demo, { platform: "desktop", atLaunch: true });
    expect(pref.json().code).toBe("family.review_account");
    expect(h.state!.db.data.pairedDevice).toEqual([]);
    expect(h.state!.db.data.serverConfig).toEqual([]);
  });

  it("un compte d'invité (mot de passe réinitialisé par un administrateur) n'a pas de « Qui regarde ? »", async () => {
    const { zoe } = await seedFamily(app, tokens);
    h.state!.jf.personalTokens.set("jf-zoe", zoe);
    for (const [, method, url, payload] of PICKER_CALLS) {
      const res = await send(method, url, "jf-zoe", payload);
      expect(res.statusCode, url).toBe(403);
      expect(res.json().code, url).toBe("family.guest_account");
    }
  });
});

describe("SEC-F-53 : les mêmes verdicts en HTTP et derrière un mandataire HTTPS", () => {
  it("rien ne dépend du protocole annoncé", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const verdicts = async (headers: Record<string, string>) => {
      const run = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
        app.inject({ method, url, headers: { authorization: `Bearer ${token}`, ...headers }, payload });
      const guest = (await run("POST", "/api/family/picker/sessions", tokens.damien, { platform: "desktop", profileId: zoe })).json().token;
      return [
        (await run("GET", "/api/family/picker/profiles?platform=desktop", tokens.damien)).statusCode,
        (await run("GET", "/api/family/picker/profiles?platform=desktop", guest)).statusCode,
        (await run("POST", "/api/family/picker/sessions", tokens.hugo, { platform: "desktop", profileId: zoe })).statusCode,
        (await run("GET", "/api/family", guest)).statusCode,
      ];
    };
    const plain = await verdicts({});
    const tls = await verdicts({ "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.9" });
    expect(plain).toEqual([200, 403, 403, 403]);
    expect(tls).toEqual(plain);
  });
});
