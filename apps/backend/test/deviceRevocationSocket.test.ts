/**
 * La socket temps réel et la révocation : une TV dont le jumelage n'existe
 * plus est refusée avec la raison « revoked » (elle l'apprend en se
 * reconnectant, même éteinte pendant le déjumelage) ; une TV jumelée reçoit
 * `session:revoked` puis la fermeture à l'instant où on la révoque ; un jeton
 * simplement refusé ne porte jamais « revoked ».
 *
 * Vrai Fastify + `@fastify/websocket`, vrai client `ws` ; base en mémoire,
 * passerelles des séances et du canal bouchonnées.
 */

import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: new Set<string>() }));

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jellyfin.invalid",
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt-") ? { userId: "u1", username: "Knaoxtest", isAdmin: false, deviceId: "d", type: "paired_device" } : null,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash: string } }) =>
        state.rows.has(args.where.tokenHash) ? { id: args.where.tokenHash } : null,
      updateMany: async () => ({ count: 1 }),
    },
  }),
}));
vi.mock("../src/services/jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));
vi.mock("../src/services/watchTogether/gateway", () => ({ handleSocketClosed: () => {}, handleWtMessage: () => {} }));
vi.mock("../src/services/deviceSessions/gateway", () => ({ handleSessionClosed: () => {}, handleSessionMessage: () => {} }));

import { wsRoutes } from "../src/routes/ws";
import { revokeDeviceByTokenHash } from "../src/services/wsManager";
import { markDeviceRevoked, resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";

const SALON = "jwt-salon.charge.signature";
const CHAMBRE = "jwt-chambre.charge.signature";

let app: FastifyInstance;
let url = "";

beforeAll(async () => {
  // Un Jellyfin qui refuse tout jeton qu'il ne connaît pas.
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
  app = Fastify();
  await app.register(websocket);
  await app.register(wsRoutes, { prefix: "/api/ws" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
});

afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  resetPairedDeviceStatusForTests();
  state.rows = new Set([`h:${SALON}`, `h:${CHAMBRE}`]);
});

interface Session {
  messages: Array<{ type: string; reason?: string }>;
  closed: Promise<number>;
  socket: WebSocket;
}

/** Ouvre une socket, s'authentifie par message (comme une TV), suit ce qui arrive. */
function connect(token: string): Promise<Session> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const messages: Session["messages"] = [];
    const closed = new Promise<number>((done) => socket.on("close", (code) => done(code)));
    socket.on("error", reject);
    socket.on("open", () => socket.send(JSON.stringify({ type: "auth", token })));
    socket.on("message", (raw) => {
      messages.push(JSON.parse(String(raw)) as Session["messages"][number]);
      if (messages.length === 1) resolve({ messages, closed, socket });
    });
  });
}

describe("la socket d'une TV révoquée", () => {
  it("est refusée avec la raison « revoked » et le code 4009", async () => {
    state.rows.delete(`h:${SALON}`);
    const session = await connect(SALON);
    expect(session.messages[0]).toEqual({ type: "auth_error", reason: "revoked" });
    expect(await session.closed).toBe(4009);
  });

  it("reçoit session:revoked puis se ferme à l'instant de la révocation", async () => {
    const session = await connect(SALON);
    expect(session.messages[0]).toEqual({ type: "auth_ok" });
    markDeviceRevoked(`h:${SALON}`);
    revokeDeviceByTokenHash(`h:${SALON}`);
    expect(await session.closed).toBe(4009);
    expect(session.messages.map((m) => m.type)).toEqual(["auth_ok", "session:revoked"]);
  });

  it("laisse la socket de l'autre TV du compte ouverte", async () => {
    const chambre = await connect(CHAMBRE);
    const salon = await connect(SALON);
    markDeviceRevoked(`h:${SALON}`);
    revokeDeviceByTokenHash(`h:${SALON}`);
    await salon.closed;
    expect(chambre.socket.readyState).toBe(WebSocket.OPEN);
    expect(chambre.messages.map((m) => m.type)).toEqual(["auth_ok"]);
    chambre.socket.close();
  });
});

describe("un refus qui n'est pas une révocation", () => {
  it("garde la raison « invalid_token »", async () => {
    const session = await connect("jeton-jellyfin-mort");
    expect(session.messages[0]).toEqual({ type: "auth_error", reason: "invalid_token" });
    expect(await session.closed).toBe(4001);
  });
});
