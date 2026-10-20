/**
 * /api/notifications : « tout marquer comme lu » couvre TOUTES les
 * notifications du compte (pas seulement la page lue), jamais celles d'un
 * autre ; chaque geste (lue, tout lu, supprimée) prévient les AUTRES
 * appareils du compte à l'instant — jamais l'auteur, et personne quand rien
 * n'a changé. Base en mémoire, auth réelle contre un faux /Users/Me (motif
 * preferences.hints.test.ts).
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNotificationStore, type FakeNotification } from "../../test/fakeNotificationDb";

const store = vi.hoisted(() => ({ rows: [] as FakeNotification[] }));
const spies = vi.hoisted(() => ({ sendToUser: vi.fn() }));

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({ sendToUser: (...args: unknown[]) => spies.sendToUser(...args) }));
vi.mock("../notifications/notificationRights", () => ({
  notificationsFiltered: async () => false,
  visibleNotificationRows: async <T>(_userId: string, rows: readonly T[]) => [...rows],
}));
vi.mock("../services/db", () => ({ hasPrisma: () => true, getPrisma: () => ({ notification: fakeNotificationStore(store) }) }));

import { notificationRoutes } from "./notifications";

function row(id: string, minutesAgo: number, read = false, userId = "u1"): FakeNotification {
  return {
    id, jellyfinUserId: userId, type: "request_status", title: id, body: null, refId: null,
    target: null, state: null, read, createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0) - minutesAgo * 60_000),
  };
}

beforeEach(() => {
  store.rows = [];
  spies.sendToUser.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => (String(input).includes("/Users/Me")
    ? new Response(JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }), { status: 200 })
    : new Response("{}", { status: 404 }))));
});

afterEach(() => { vi.unstubAllGlobals(); });

async function makeApp() {
  const app = Fastify();
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const othersWarned = () => expect(spies.sendToUser).toHaveBeenCalledWith(
  "u1", { type: "notifications:update", action: "refresh" }, { exceptTokenHash: "jeton-banc" },
);

describe("POST /api/notifications/read-all", () => {
  it("lit TOUTES les notifications du compte, au-delà de la première page, jamais celles d'un autre", async () => {
    store.rows = Array.from({ length: 45 }, (_, i) => row(`n${i}`, i));
    store.rows.push(row("autre", 1, false, "u2"));
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/notifications/read-all", headers });
    expect(res.statusCode).toBe(200);
    expect(store.rows.filter((n) => n.jellyfinUserId === "u1" && !n.read)).toHaveLength(0);
    expect(store.rows.find((n) => n.id === "autre")?.read).toBe(false);
    const count = await app.inject({ method: "GET", url: "/api/notifications/unread-count", headers });
    expect(count.json()).toEqual({ count: 0 });
    await app.close();
  });

  it("prévient les autres appareils du compte, pas l'auteur ; rien à lire : personne", async () => {
    store.rows = [row("a", 1), row("b", 2, true)];
    const app = await makeApp();
    await app.inject({ method: "POST", url: "/api/notifications/read-all", headers });
    expect(spies.sendToUser).toHaveBeenCalledTimes(1);
    othersWarned();
    spies.sendToUser.mockClear();
    await app.inject({ method: "POST", url: "/api/notifications/read-all", headers });
    expect(spies.sendToUser).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /api/notifications/:id/read", () => {
  it("une non lue : lue, et les autres appareils prévenus ; déjà lue : rien", async () => {
    store.rows = [row("a", 1), row("b", 2, true)];
    const app = await makeApp();
    await app.inject({ method: "POST", url: "/api/notifications/a/read", headers });
    expect(store.rows.find((n) => n.id === "a")?.read).toBe(true);
    othersWarned();
    spies.sendToUser.mockClear();
    await app.inject({ method: "POST", url: "/api/notifications/b/read", headers });
    expect(spies.sendToUser).not.toHaveBeenCalled();
    await app.close();
  });

  it("celle d'un autre compte : 404, rien de changé", async () => {
    store.rows = [row("x", 1, false, "u2")];
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/notifications/x/read", headers });
    expect(res.statusCode).toBe(404);
    expect(store.rows[0].read).toBe(false);
    await app.close();
  });
});

describe("DELETE /api/notifications", () => {
  it("supprimer prévient les autres appareils, à l'instant", async () => {
    store.rows = [row("a", 1), row("b", 2)];
    const app = await makeApp();
    await app.inject({ method: "DELETE", url: "/api/notifications/a", headers });
    othersWarned();
    await app.inject({ method: "DELETE", url: "/api/notifications/all", headers });
    expect(store.rows).toHaveLength(0);
    expect(spies.sendToUser).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
