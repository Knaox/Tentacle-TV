/**
 * Banc Watch Together EN MÉMOIRE (arrivée, départ — lot du 20/10 soir) : les
 * vraies routes REST (Fastify, authentification contre un faux Jellyfin), les
 * vraies sockets du gestionnaire (factices), le vrai gateway, l'horloge des
 * minuteries factices. Un appareil = un jeton (`hashToken` simulé : le jeton
 * même), « jeton-<compte>-<appareil> ».
 *
 * Les `vi.mock` vivent dans chaque fichier de test (ils doivent y être hissés) :
 * configStore, jwt, jellyfinCache, accessWatch, hostSettings, familyGuestMarkers,
 * itemVisibility. Les modules sont chargés APRÈS les minuteries factices
 * (`loadWtRig`) : le gestionnaire arme un nettoyage périodique à l'import.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { vi } from "vitest";
import { modernJellyfinToken } from "./jellyfinFakeAuth";
import type { JellyfinUser } from "../src/middleware/auth";
import type { WtRoomStateDto, WtStateCause } from "../src/services/watchTogether/protocol";

export const NAMES = { a: "Alice", b: "Bob", c: "Chloé" } as const;
export type Who = keyof typeof NAMES;

type FakeSocket = { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
type Received = { type: string } & Record<string, unknown>;
export interface StateMessage { state: WtRoomStateDto; cause: WtStateCause; originUserId: string | null }

export interface Device {
  who: Who;
  key: string;
  user: JellyfinUser;
  socket: FakeSocket;
}

/** Ce qu'un appareil a reçu, dans l'ordre. */
export function received(device: Device): Received[] {
  return device.socket.send.mock.calls.map(([raw]) => JSON.parse(String(raw)) as Received);
}

/** Les états de salle reçus par un appareil. */
export function states(device: Device): StateMessage[] {
  return received(device).filter((m) => m.type === "wt:state") as unknown as StateMessage[];
}

export function lastState(device: Device): StateMessage {
  const all = states(device);
  if (all.length === 0) throw new Error(`${device.key} n'a reçu aucun état`);
  return all[all.length - 1];
}

/** Les promesses en cours (file d'ordre des salles, réponses REST). */
export const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Minuteries et date factices ; `setImmediate` reste vrai (Fastify, `flush`). */
export function useWtClock(now: number): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(now);
}

/** Le faux Jellyfin : `/Users` (clé d'admin) et `/Users/Me` (jeton d'un appareil). */
export function stubJellyfin(): void {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const token = modernJellyfinToken(init?.headers, url);
    if (url.endsWith("/Users") && token === "cle-admin") {
      return Response.json(Object.entries(NAMES).map(([id, name]) => ({
        Id: id, Name: name, Policy: { SyncPlayAccess: "CreateAndJoinGroups" },
      })));
    }
    const who = token.replace("jeton-", "").split("-")[0] as Who;
    return NAMES[who] && url.endsWith("/Users/Me")
      ? Response.json({ Id: who, Name: NAMES[who], Policy: { IsAdministrator: false } })
      : new Response("{}", { status: 401 });
  }));
}

export async function loadWtRig() {
  const ws = await import("../src/services/wsManager");
  const gateway = await import("../src/services/watchTogether/gateway");
  const registry = await import("../src/services/watchTogether/roomRegistry");
  const sync = await import("../src/services/watchTogether/sync");
  const { watchTogetherRoutes } = await import("../src/routes/watchTogether");
  const { watchTogetherInviteRoutes } = await import("../src/routes/watchTogetherInvites");
  const { invalidateJellyfinUsers } = await import("../src/services/watchTogether/usersCache");
  gateway.registerWatchTogetherGateway();

  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });

  const plugged: Device[] = [];

  /** Un appareil branché : sa socket ouverte, au nom de son compte. */
  function device(who: Who, name: string): Device {
    const d: Device = {
      who,
      key: `jeton-${who}-${name}`,
      user: { userId: who, username: NAMES[who], isAdmin: false },
      socket: { readyState: 1, send: vi.fn(), close: vi.fn() },
    };
    ws.addConnection(who, d.socket as never, d.key);
    plugged.push(d);
    return d;
  }

  /** Sa socket se ferme (appli tuée, réseau coupé et constaté). */
  function unplug(d: Device): void {
    d.socket.readyState = 3;
    gateway.handleSocketClosed(d.who, d.socket as never);
    ws.removeConnection(d.who, d.socket as never, d.key);
    plugged.splice(plugged.indexOf(d), 1);
  }

  /** Un appel REST de cet appareil. */
  async function call(d: Device, method: "GET" | "POST", url: string, payload?: object) {
    const res = await app.inject({
      method, url: `/api/watch-together${url}`, headers: { "x-emby-token": d.key }, ...(payload ? { payload } : {}),
    });
    return { status: res.statusCode, body: res.json() as Record<string, unknown> };
  }

  /** Un message `wt:*` de cet appareil, par sa socket. */
  async function send(d: Device, msg: { type: string } & Record<string, unknown>): Promise<void> {
    gateway.handleWtMessage(d.user, msg, d.socket as never);
    await flush();
  }

  const room = (who: Who) => {
    const r = registry.getRoomOf(who);
    if (!r) throw new Error(`${who} n'est dans aucune salle`);
    return r;
  };

  /** Le lecteur de cet appareil s'ouvre sur le titre, charge, puis est prêt. */
  async function openPlayer(d: Device, itemId: string): Promise<void> {
    await send(d, { type: "wt:presence", inPlayback: true, itemId, protocolVersion: 2 });
    await send(d, { type: "wt:buffering", buffering: true });
  }
  async function ready(d: Device): Promise<void> {
    await send(d, { type: "wt:buffering", buffering: false, barrierId: room(d.who).barrier?.id });
  }

  /** L'invitation de `host` à `guest`, telle que la socket de l'invité la reçoit. */
  async function invite(host: Device, guest: Device): Promise<string> {
    await call(host, "POST", "/group/invites", { userIds: [guest.who] });
    const msg = received(guest).filter((m) => m.type === "wt:invite").at(-1);
    if (!msg) throw new Error("invitation non reçue");
    return (msg.invite as { inviteId: string }).inviteId;
  }

  async function reset(): Promise<void> {
    for (const who of Object.keys(NAMES)) sync.removeMemberAndSync(who);
    for (const d of [...plugged]) ws.removeConnection(d.who, d.socket as never, d.key);
    plugged.length = 0;
    invalidateJellyfinUsers();
    // Pas de `vi.clearAllTimers()` : le balayage anti-gel du gateway (15 s) est
    // armé une seule fois ; les minuteries des salles partent avec elles.
  }

  return { ws, gateway, sync, device, unplug, call, send, room, openPlayer, ready, invite, reset, close: () => app.close() };
}

export type WtRig = Awaited<ReturnType<typeof loadWtRig>>;
