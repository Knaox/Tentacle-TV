/**
 * Les routes /api/tickets de bout en bout : auth réelle (Jellyfin bouchonné
 * via le fetch global, motif watchlist.test.ts), Prisma en mémoire, et surtout
 * QUI est notifié de quoi — les admins sauf l'acteur, l'auteur sauf lui-même,
 * jamais deux fois le même statut — avec un rafraîchissement WS par
 * destinataire.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface TicketRow {
  id: string; jellyfinUserId: string; username: string; subject: string;
  category: string; status: string; mediaItemId: string | null; mediaItemName: string | null;
  createdAt: Date; updatedAt: Date;
}
interface MessageRow {
  id: string; ticketId: string; jellyfinUserId: string; username: string;
  isAdmin: boolean; body: string; createdAt: Date;
}
interface NotifRow { jellyfinUserId: string; type: string; title: string; body: string; refId: string }

const tickets = new Map<string, TicketRow>();
const messages: MessageRow[] = [];
const notifications: NotifRow[] = [];
let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

const wsSend = vi.fn();
const listUsersRights = vi.fn();

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({ sendToUser: (...args: unknown[]) => wsSend(...args) }));
vi.mock("../services/jellyfinAdminPolicy", () => ({ listUsersRights: () => listUsersRights() }));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    supportTicket: {
      create: async (args: { data: Record<string, unknown> & { messages: { create: Record<string, unknown> } } }) => {
        const { messages: nested, ...data } = args.data;
        const now = new Date();
        const row: TicketRow = {
          id: nextId("t"), status: "open", mediaItemId: null, mediaItemName: null,
          createdAt: now, updatedAt: now, ...(data as Partial<TicketRow>),
        } as TicketRow;
        tickets.set(row.id, row);
        const msg: MessageRow = { id: nextId("m"), ticketId: row.id, createdAt: now, ...(nested.create as Omit<MessageRow, "id" | "ticketId" | "createdAt">) };
        messages.push(msg);
        return { ...row, messages: [msg] };
      },
      findUnique: async (args: { where: { id: string }; include?: unknown }) => {
        const row = tickets.get(args.where.id);
        if (!row) return null;
        return args.include ? { ...row, messages: messages.filter((m) => m.ticketId === row.id) } : row;
      },
      update: async (args: { where: { id: string }; data: Partial<TicketRow>; include?: unknown }) => {
        const row = { ...tickets.get(args.where.id)!, ...args.data };
        tickets.set(row.id, row);
        return args.include ? { ...row, messages: messages.filter((m) => m.ticketId === row.id) } : row;
      },
      deleteMany: async (args: { where: { id: { in: string[] } } }) => {
        let count = 0;
        for (const id of args.where.id.in) if (tickets.delete(id)) count++;
        return { count };
      },
    },
    ticketMessage: {
      create: async (args: { data: Omit<MessageRow, "id" | "createdAt"> }) => {
        const msg: MessageRow = { id: nextId("m"), createdAt: new Date(), ...args.data };
        messages.push(msg);
        return msg;
      },
    },
    notification: {
      createMany: async (args: { data: NotifRow[] }) => {
        notifications.push(...args.data);
        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { refId: { in: string[] } } }) => {
        const before = notifications.length;
        for (let i = notifications.length - 1; i >= 0; i--) {
          if (args.where.refId.in.includes(notifications[i].refId)) notifications.splice(i, 1);
        }
        return { count: before - notifications.length };
      },
    },
  }),
}));

import { ticketRoutes } from "./tickets";
import { resetAdminRecipientsCache } from "../services/ticketNotifier";

const USERS: Record<string, { Id: string; Name: string; Policy: { IsAdministrator: boolean } }> = {
  "jeton-alice": { Id: "u-alice", Name: "alice", Policy: { IsAdministrator: false } },
  "jeton-root": { Id: "a-root", Name: "root", Policy: { IsAdministrator: true } },
  "jeton-bob": { Id: "a-bob", Name: "bob", Policy: { IsAdministrator: true } },
};
const ADMINS = [
  { id: "a-root", name: "root", isAdministrator: true },
  { id: "a-bob", name: "bob", isAdministrator: true },
  { id: "u-alice", name: "alice", isAdministrator: false },
];
const as = (token: string) => ({ "x-emby-token": token });

beforeEach(() => {
  tickets.clear(); messages.length = 0; notifications.length = 0; seq = 0;
  wsSend.mockReset();
  listUsersRights.mockReset().mockResolvedValue(ADMINS);
  resetAdminRecipientsCache();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/Users/Me")) {
      // Le middleware présente le jeton en `X-Emby-Token` (cf. auth.ts).
      const token = String((init?.headers as Record<string, string>)?.["X-Emby-Token"] ?? "");
      const user = USERS[token];
      return user ? new Response(JSON.stringify(user), { status: 200 }) : new Response("{}", { status: 401 });
    }
    return new Response("{}", { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(ticketRoutes, { prefix: "/api/tickets" });
  return app;
}

async function createTicket(app: Awaited<ReturnType<typeof makeApp>>, token: string) {
  const res = await app.inject({
    method: "POST", url: "/api/tickets", headers: as(token),
    payload: { subject: "Sous-titres décalés", body: "  Le lecteur plante sur l'épisode 3  " },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string };
}

const refresh = { type: "notifications:update", action: "refresh" };

describe("création d'un ticket", () => {
  it("prévient chaque admin, avec l'auteur puis l'extrait en corps, et un WS par admin", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    expect(notifications).toEqual([
      { jellyfinUserId: "a-root", type: "ticket_new", title: "Sous-titres décalés", body: "alice\nLe lecteur plante sur l'épisode 3", refId: id },
      { jellyfinUserId: "a-bob", type: "ticket_new", title: "Sous-titres décalés", body: "alice\nLe lecteur plante sur l'épisode 3", refId: id },
    ]);
    expect(wsSend).toHaveBeenCalledTimes(2);
    expect(wsSend).toHaveBeenCalledWith("a-root", refresh);
    expect(wsSend).toHaveBeenCalledWith("a-bob", refresh);
    await app.close();
  });

  it("un admin qui ouvre un ticket prévient les autres admins, pas lui-même", async () => {
    const app = await makeApp();
    await createTicket(app, "jeton-root");
    expect(notifications.map((n) => n.jellyfinUserId)).toEqual(["a-bob"]);
    await app.close();
  });

  it("Jellyfin injoignable : le ticket existe, personne n'est prévenu", async () => {
    listUsersRights.mockRejectedValue(new Error("jellyfin-unreachable"));
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    expect(tickets.has(id)).toBe(true);
    expect(notifications).toEqual([]);
    expect(wsSend).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("réponses", () => {
  it("l'auteur qui répond prévient les admins ; l'admin qui répond ne prévient que l'auteur", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    notifications.length = 0; wsSend.mockReset();

    const mine = await app.inject({ method: "POST", url: `/api/tickets/${id}/reply`, headers: as("jeton-alice"), payload: { body: "Toujours pareil" } });
    expect(mine.statusCode).toBe(201);
    expect(notifications).toEqual([
      { jellyfinUserId: "a-root", type: "ticket_user_reply", title: "Sous-titres décalés", body: "alice\nToujours pareil", refId: id },
      { jellyfinUserId: "a-bob", type: "ticket_user_reply", title: "Sous-titres décalés", body: "alice\nToujours pareil", refId: id },
    ]);

    notifications.length = 0; wsSend.mockReset();
    const theirs = await app.inject({ method: "POST", url: `/api/tickets/${id}/reply`, headers: as("jeton-root"), payload: { body: "On regarde ça" } });
    expect(theirs.statusCode).toBe(201);
    expect(notifications).toEqual([
      { jellyfinUserId: "u-alice", type: "ticket_reply", title: "Sous-titres décalés", body: "On regarde ça", refId: id },
    ]);
    expect(wsSend).toHaveBeenCalledTimes(1);
    expect(wsSend).toHaveBeenCalledWith("u-alice", refresh);
    await app.close();
  });

  it("un admin qui répond à son propre ticket ne se notifie pas", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-root");
    notifications.length = 0;
    const res = await app.inject({ method: "POST", url: `/api/tickets/${id}/reply`, headers: as("jeton-root"), payload: { body: "Note pour moi" } });
    expect(res.statusCode).toBe(201);
    expect(notifications).toEqual([]);
    await app.close();
  });
});

describe("changement de statut", () => {
  it("le même statut ne réécrit rien ; un nouveau statut prévient l'auteur avec la valeur brute", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    notifications.length = 0; wsSend.mockReset();

    const same = await app.inject({ method: "PATCH", url: `/api/tickets/${id}/status`, headers: as("jeton-root"), payload: { status: "open" } });
    expect(same.statusCode).toBe(200);
    expect(notifications).toEqual([]);
    expect(wsSend).not.toHaveBeenCalled();

    const moved = await app.inject({ method: "PATCH", url: `/api/tickets/${id}/status`, headers: as("jeton-root"), payload: { status: "in_progress" } });
    expect(moved.statusCode).toBe(200);
    expect(tickets.get(id)?.status).toBe("in_progress");
    expect(notifications).toEqual([
      { jellyfinUserId: "u-alice", type: "ticket_status", title: "Sous-titres décalés", body: "in_progress", refId: id },
    ]);
    expect(wsSend).toHaveBeenCalledWith("u-alice", refresh);
    await app.close();
  });

  it("refusé à un non-admin", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    const res = await app.inject({ method: "PATCH", url: `/api/tickets/${id}/status`, headers: as("jeton-alice"), payload: { status: "closed" } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("fermeture par l'auteur et suppression", () => {
  it("l'auteur ferme avec un motif : message dans le fil, statut fermé, admins prévenus", async () => {
    const app = await makeApp();
    const { id } = await createTicket(app, "jeton-alice");
    notifications.length = 0;
    const empty = await app.inject({ method: "POST", url: `/api/tickets/${id}/close`, headers: as("jeton-alice"), payload: { reason: "   " } });
    expect(empty.statusCode).toBe(400);
    const res = await app.inject({ method: "POST", url: `/api/tickets/${id}/close`, headers: as("jeton-alice"), payload: { reason: "Résolu de mon côté" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "closed" });
    expect(res.json().messages.at(-1)).toMatchObject({ body: "Résolu de mon côté", isAdmin: false });
    expect(notifications.map((n) => [n.jellyfinUserId, n.type, n.body])).toEqual([
      ["a-root", "ticket_user_closed", "alice\nRésolu de mon côté"],
      ["a-bob", "ticket_user_closed", "alice\nRésolu de mon côté"],
    ]);
    const again = await app.inject({ method: "POST", url: `/api/tickets/${id}/close`, headers: as("jeton-alice"), payload: { reason: "encore" } });
    expect(again.statusCode).toBe(400);
    await app.close();
  });

  it("l'admin supprime plusieurs tickets, notifications comprises ; un inconnu fait 404", async () => {
    const app = await makeApp();
    const { id: a } = await createTicket(app, "jeton-alice");
    const { id: b } = await createTicket(app, "jeton-alice");
    expect(notifications.filter((n) => n.refId === a || n.refId === b)).toHaveLength(4);
    const forbidden = await app.inject({ method: "DELETE", url: "/api/tickets/batch", headers: as("jeton-alice"), payload: { ids: [a] } });
    expect(forbidden.statusCode).toBe(403);
    const res = await app.inject({ method: "DELETE", url: "/api/tickets/batch", headers: as("jeton-root"), payload: { ids: [a, b] } });
    expect(res.json()).toEqual({ deleted: 2 });
    expect(tickets.size).toBe(0);
    expect(notifications.filter((n) => n.refId === a || n.refId === b)).toHaveLength(0);
    const missing = await app.inject({ method: "DELETE", url: `/api/tickets/${a}`, headers: as("jeton-root") });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
