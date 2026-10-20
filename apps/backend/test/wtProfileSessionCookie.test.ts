/**
 * Watch Together depuis une SESSION DE PROFIL, sur un téléphone qui garde le
 * cookie de sa CONNEXION (alpha mobile 1.20.0, 20/10 — Damien : « le
 * propriétaire du groupe s'appelait Knaox, mon compte, au lieu du profil » ;
 * « il accepte, mais pour le propriétaire c'est comme s'il n'avait jamais
 * accepté, et il paraît hors ligne »).
 *
 * React Native garde le cookie `tentacle_token` posé par `/api/auth/login` (le
 * jeton du COMPTE) et le renvoie avec chaque requête et chaque poignée de main
 * WebSocket. Deux téléphones croisés, comme la Famille de test du lot :
 * A connecté en Knaoxtest, profil Knaoxtest2 ouvert ; B connecté en
 * Knaoxtest2, profil Knaoxtest ouvert. Chaque requête porte le cookie du
 * compte ET le jeton du profil (Bearer, message `auth`) — c'est le PROFIL.
 *
 * Vrai Fastify (+ cookie, + websocket), vrai client `ws`, vraies routes et
 * vraie passerelle de Watch Together ; Jellyfin, base et Famille bouchonnés.
 */

import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import WebSocket from "ws";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "./jellyfinFakeAuth";

const fake = vi.hoisted(() => ({
  // Les comptes (jetons Jellyfin de connexion) et les sessions de profil (JWT d'appareil).
  accounts: { "jf-knaoxtest-a": ["u-knaoxtest", "Knaoxtest"], "jf-knaoxtest2-b": ["u-knaoxtest2", "Knaoxtest2"] } as Record<string, [string, string]>,
  profiles: { "jwt.knaoxtest2-sur-a.sig": ["u-knaoxtest2", "Knaoxtest2"], "jwt.knaoxtest-sur-b.sig": ["u-knaoxtest", "Knaoxtest"] } as Record<string, [string, string]>,
}));

vi.mock("../src/services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) => {
    const profile = fake.profiles[token];
    return profile
      ? { userId: profile[0], username: profile[1], isAdmin: false, deviceId: `d-${token}`, type: "paired_device", scope: "profile", pairingId: "hote" }
      : null;
  },
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({ pairedDevice: { findUnique: async () => ({ id: "pd" }), updateMany: async () => ({ count: 1 }) } }),
}));
vi.mock("../src/services/jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));
vi.mock("../src/services/deviceSessions/gateway", () => ({ handleSessionClosed: () => {}, handleSessionMessage: () => {} }));
vi.mock("../src/services/family/familyGuestMarkers", async (original) => ({
  ...(await original<object>()),
  withoutFamilyGuests: async <T>(list: T[]) => list,
  isFamilyGuest: async () => false,
}));
vi.mock("../src/services/accountAccess/accountAccessState", async (original) => ({
  ...(await original<object>()),
  sessionAccessRefusal: async () => null,
}));
vi.mock("../src/services/accountAccess/socketAccess", () => ({ blockedSocketAccess: async () => null, refuseBlockedSocket: () => {} }));
vi.mock("../src/services/itemAccess/itemVisibility", () => ({ isItemVisibleTo: async () => true }));
vi.mock("../src/services/watchTogether/hostSettings", () => ({ refreshHostSettings: async () => undefined }));
vi.mock("../src/services/watchTogether/accessWatch", () => ({ registerAccessWatch: () => undefined }));
vi.mock("../src/services/sessionTokenChoice", async (original) => ({
  ...(await original<object>()),
  WS_COOKIE_FALLBACK_MS: 150,
}));

import { wsRoutes } from "../src/routes/ws";
import { watchTogetherRoutes } from "../src/routes/watchTogether";
import { watchTogetherInviteRoutes } from "../src/routes/watchTogetherInvites";
import { watchTogetherUsersRoutes } from "../src/routes/watchTogetherUsers";
import { registerWatchTogetherGateway } from "../src/services/watchTogether/gateway";
import { removeMemberAndSync } from "../src/services/watchTogether/sync";
import { isUserOnline } from "../src/services/wsManager";

type Msg = { type: string } & Record<string, unknown>;
interface Phone { account: string; profile: string; socket: WebSocket; inbox: Msg[] }

const A = { account: "jf-knaoxtest-a", profile: "jwt.knaoxtest2-sur-a.sig" };
const B = { account: "jf-knaoxtest2-b", profile: "jwt.knaoxtest-sur-b.sig" };
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

let app: FastifyInstance;
let wsUrl = "";
const opened: WebSocket[] = [];

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const token = modernJellyfinToken(init?.headers, url);
    const all = Object.values(fake.accounts).map(([Id, Name]) => ({ Id, Name, Policy: { SyncPlayAccess: "CreateAndJoinGroups" } }));
    if (url.endsWith("/Users") && token === "cle-admin") return Response.json(all);
    const account = fake.accounts[token];
    if (url.endsWith("/Users/Me") && account) return Response.json({ Id: account[0], Name: account[1], Policy: { IsAdministrator: false } });
    return new Response("{}", { status: 401 });
  }));
  app = Fastify();
  await app.register(cookie);
  await app.register(websocket);
  await app.register(wsRoutes, { prefix: "/api/ws" });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherUsersRoutes, { prefix: "/api/watch-together" });
  registerWatchTogetherGateway();
  await app.listen({ port: 0, host: "127.0.0.1" });
  wsUrl = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
});

afterAll(async () => {
  for (const socket of opened) socket.close();
  await app.close();
  vi.unstubAllGlobals();
});

async function waitFor<T>(find: () => T | undefined, what: string): Promise<T> {
  for (let i = 0; i < 200; i += 1) {
    const found = find();
    if (found !== undefined && found !== false) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`jamais arrivé : ${what}`);
}

/** Toutes les sockets fermées, et vues fermées par le serveur. */
async function closeAll(): Promise<void> {
  for (const socket of opened.splice(0)) socket.close();
  await waitFor(() => (!isUserOnline("u-knaoxtest") && !isUserOnline("u-knaoxtest2")) || undefined, "sockets fermées");
}

/** Une socket comme celle de React Native : le cookie du pot, d'autres en-têtes au besoin. */
async function openSocket(account: string, headers: Record<string, string> = {}): Promise<Pick<Phone, "socket" | "inbox">> {
  const socket = new WebSocket(wsUrl, { headers: { cookie: `tentacle_token=${account}`, ...headers } });
  opened.push(socket);
  const inbox: Msg[] = [];
  socket.on("message", (raw) => inbox.push(JSON.parse(String(raw)) as Msg));
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  return { socket, inbox };
}

/** Le téléphone ouvert sur un profil : il s'annonce à l'ouverture, comme `tentacleSocket`. */
async function openPhone(device: { account: string; profile: string }): Promise<Phone> {
  const { socket, inbox } = await openSocket(device.account);
  socket.send(JSON.stringify({ type: "auth", token: device.profile }));
  await waitFor(() => inbox.find((m) => m.type === "auth_ok"), "auth_ok");
  return { ...device, socket, inbox };
}

/** Un appel REST du téléphone : le cookie de son pot ET le Bearer de son profil. */
function rest(phone: { account: string; profile: string }, method: "GET" | "POST", url: string, payload?: object) {
  return app.inject({
    method,
    url: `/api/watch-together${url}`,
    cookies: { tentacle_token: phone.account },
    headers: { authorization: `Bearer ${phone.profile}` },
    ...(payload ? { payload } : {}),
  });
}

type Member = { userId: string; username: string; online: boolean; isHost: boolean };
const membersOf = (msg: Msg | undefined) => ((msg?.state as { members?: Member[] } | undefined)?.members ?? []);

describe("deux téléphones croisés, chacun sur le profil de l'autre compte", () => {
  let a: Phone;
  let b: Phone;

  afterAll(async () => {
    removeMemberAndSync("u-knaoxtest");
    removeMemberAndSync("u-knaoxtest2");
    await closeAll();
  });

  it("les sockets sont celles des PROFILS, jamais des comptes du cookie", async () => {
    a = await openPhone(A);
    expect(isUserOnline("u-knaoxtest2")).toBe(true);
    expect(isUserOnline("u-knaoxtest")).toBe(false); // le compte de A, dans son cookie
    b = await openPhone(B);
    expect(isUserOnline("u-knaoxtest")).toBe(true);
  });

  it("A crée : l'hôte est son profil Knaoxtest2, en ligne", async () => {
    const res = await rest(A, "POST", "/group", {});
    expect(res.statusCode).toBe(200);
    const room = res.json() as { hostUserId: string; members: Member[] };
    expect(room.hostUserId).toBe("u-knaoxtest2");
    expect(room.members).toEqual([expect.objectContaining({ userId: "u-knaoxtest2", username: "Knaoxtest2", online: true, isHost: true })]);
  });

  it("la liste des invitables : B (profil Knaoxtest) en ligne, A elle-même absente", async () => {
    const users = (await rest(A, "GET", "/users")).json() as Array<{ id: string; isOnline: boolean }>;
    expect(users.find((u) => u.id === "u-knaoxtest")).toMatchObject({ isOnline: true });
    expect(users.some((u) => u.id === "u-knaoxtest2")).toBe(false);
  });

  it("l'invitation arrive sur B ; acceptée, l'hôte le voit AUSSITÔT, en ligne", async () => {
    a.inbox.length = 0;
    expect((await rest(A, "POST", "/group/invites", { userIds: ["u-knaoxtest"] })).json()).toEqual({ invited: ["u-knaoxtest"] });
    const invite = await waitFor(() => b.inbox.find((m) => m.type === "wt:invite"), "wt:invite sur B");
    expect(invite.invite).toMatchObject({ fromUserId: "u-knaoxtest2", fromUsername: "Knaoxtest2" });

    const inviteId = (invite.invite as { inviteId: string }).inviteId;
    const accepted = await rest(B, "POST", `/invites/${inviteId}/respond`, { accept: true });
    expect(accepted.statusCode).toBe(200);
    expect((accepted.json() as { members: Member[] }).members.map((m) => m.userId)).toEqual(["u-knaoxtest2", "u-knaoxtest"]);

    const result = await waitFor(() => a.inbox.find((m) => m.type === "wt:inviteResult"), "wt:inviteResult sur A");
    expect(result).toMatchObject({ toUserId: "u-knaoxtest", toUsername: "Knaoxtest", accepted: true });
    const joined = await waitFor(() => a.inbox.find((m) => m.type === "wt:state" && m.cause === "join"), "wt:state join sur A");
    expect(membersOf(joined).find((m) => m.userId === "u-knaoxtest")).toMatchObject({ username: "Knaoxtest", online: true });
  });

  it("en ligne = un appareil tient la session du profil : B fermé, l'hôte le voit hors ligne", async () => {
    a.inbox.length = 0;
    b.socket.close();
    const presence = await waitFor(
      () => a.inbox.find((m) => m.type === "wt:state" && membersOf(m).find((x) => x.userId === "u-knaoxtest")?.online === false),
      "B hors ligne vu par A",
    );
    expect(membersOf(presence).find((m) => m.userId === "u-knaoxtest2")?.online).toBe(true);
  });
});

describe("la règle, porte par porte", () => {
  afterEach(closeAll);

  it("REST : le cookie seul (la page web) reste le compte ; avec le Bearer d'un profil, c'est le profil", async () => {
    const webOnly = await app.inject({ method: "GET", url: "/api/watch-together/users", cookies: { tentacle_token: A.account } });
    expect((webOnly.json() as Array<{ id: string }>).map((u) => u.id)).toEqual(["u-knaoxtest2"]);
    const phone = (await rest(A, "GET", "/users")).json() as Array<{ id: string }>;
    expect(phone.map((u) => u.id)).toEqual(["u-knaoxtest"]);
  });

  it("un navigateur (« Mozilla/… ») est authentifié par son cookie, aussitôt, sans message", async () => {
    const { inbox } = await openSocket(A.account, { "user-agent": BROWSER });
    await waitFor(() => inbox.find((m) => m.type === "auth_ok"), "auth_ok du navigateur");
    expect(isUserOnline("u-knaoxtest")).toBe(true);
  });

  it("filet : même pris pour un navigateur, le message `auth` d'un profil l'emporte sur le cookie de connexion", async () => {
    const { socket, inbox } = await openSocket(A.account, { "user-agent": BROWSER });
    socket.send(JSON.stringify({ type: "auth", token: A.profile }));
    await waitFor(() => isUserOnline("u-knaoxtest2") || undefined, "la socket au profil");
    await waitFor(() => !isUserOnline("u-knaoxtest") || undefined, "plus au compte");
    expect(inbox.filter((m) => m.type === "auth_error")).toEqual([]);
  });

  it("la session de profil du web (cookie JWT posé par le serveur) : un message `auth` ne la remplace pas", async () => {
    const { socket, inbox } = await openSocket(A.profile, { "user-agent": BROWSER });
    await waitFor(() => inbox.find((m) => m.type === "auth_ok"), "auth_ok du profil");
    socket.send(JSON.stringify({ type: "auth", token: A.account }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isUserOnline("u-knaoxtest2")).toBe(true);
    expect(isUserOnline("u-knaoxtest")).toBe(false);
  });

  it("une app native muette retombe sur le cookie de son pot, au bout du délai", async () => {
    const { inbox } = await openSocket(A.account);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(inbox.some((m) => m.type === "auth_ok")).toBe(false); // elle attend son message
    await waitFor(() => inbox.find((m) => m.type === "auth_ok"), "auth_ok du repli");
    expect(isUserOnline("u-knaoxtest")).toBe(true);
  });

  it("le message `auth` arrivé APRÈS ce repli l'emporte encore : la socket passe au profil", async () => {
    const { socket, inbox } = await openSocket(A.account);
    await waitFor(() => inbox.find((m) => m.type === "auth_ok"), "auth_ok du repli");
    expect(isUserOnline("u-knaoxtest")).toBe(true);
    socket.send(JSON.stringify({ type: "auth", token: A.profile }));
    await waitFor(() => inbox.filter((m) => m.type === "auth_ok").length === 2 || undefined, "second auth_ok");
    expect(isUserOnline("u-knaoxtest2")).toBe(true);
    expect(isUserOnline("u-knaoxtest")).toBe(false);
  });
});
