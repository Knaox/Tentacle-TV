/**
 * Le réveil d'un iPhone dont un titre attend qu'une extension le prépare : à
 * l'heure que l'extension a dite (503 + Retry-After sur sa route `offline`), une
 * push silencieuse `offline:prepared` part vers les iPhone du compte.
 */

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../pushService", () => ({ sendSilentToUser: vi.fn(async () => 1) }));
vi.mock("./offlinePrepare", () => ({ PREPARED_PUSH_TYPE: "offline:prepared" }));
vi.mock("../pluginServerModule", () => ({ readPluginManifest: () => null }));

const { noteExtensionWait, offlineRequestOf, retryAfterMs, WAKE_MARGIN_MS, WAKE_MIN_GAP_MS, WaitWakes } = await import("./extensionWaitWake");

/** Des minuteurs à la main : on avance l'horloge, on déclenche ce qui est échu. */
function fakeClock() {
  let now = 1_000_000;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  return {
    now: () => now,
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = next++;
        pending.set(id, { at: now + ms, fn });
        return id;
      },
      clear: (handle: unknown) => void pending.delete(handle as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) if (t.at <= now) {
        pending.delete(id);
        t.fn();
      }
    },
    count: () => pending.size,
  };
}

const ROUTE = (id: string) => (id === "sillon" ? "/music/offline" : null);

describe("règles", () => {
  it("le Retry-After d'un 503, en secondes ou en date, borné", () => {
    expect(retryAfterMs(503, "120", 0)).toBe(120_000);
    expect(retryAfterMs(503, new Date(60_000).toUTCString(), 0)).toBe(60_000);
    expect(retryAfterMs(503, "0", 0)).toBe(1_000);
    expect(retryAfterMs(503, "999999", 0)).toBe(6 * 3_600_000);
    expect(retryAfterMs(200, "120", 0)).toBeNull();
    expect(retryAfterMs(503, "bientôt", 0)).toBeNull();
    expect(retryAfterMs(503, null, 0)).toBeNull();
  });

  it("seule la route `offline` déclarée par l'extension compte", () => {
    expect(offlineRequestOf("/api/plugins/sillon/music/offline/ytm%3At%3Ax?api_key=k", ROUTE)).toBe("sillon");
    expect(offlineRequestOf("/api/plugins/sillon/music/search?q=x", ROUTE)).toBeNull();
    expect(offlineRequestOf("/api/plugins/sillon/music/offline", ROUTE)).toBeNull();
    expect(offlineRequestOf("/api/plugins/vigie/music/offline/x", ROUTE)).toBeNull();
    expect(offlineRequestOf("/api/downloads/light/abc", ROUTE)).toBeNull();
  });
});

describe("échéances par compte", () => {
  it("une push à l'heure dite (plus une marge), la plus proche seulement", () => {
    const clock = fakeClock();
    const sent: string[] = [];
    const wakes = new WaitWakes((u) => sent.push(u), clock.now, clock.timers);
    wakes.note("u1", 120_000);
    wakes.note("u1", 30_000);
    wakes.note("u1", 600_000);
    expect(clock.count()).toBe(1);
    clock.advance(30_000 + WAKE_MARGIN_MS - 1);
    expect(sent).toEqual([]);
    clock.advance(1);
    expect(sent).toEqual(["u1"]);
  });

  it("jamais deux pushes du même compte à moins d'une minute ; les comptes sont indépendants", () => {
    const clock = fakeClock();
    const sent: string[] = [];
    const wakes = new WaitWakes((u) => sent.push(u), clock.now, clock.timers);
    wakes.note("u1", 1_000);
    wakes.note("u2", 1_000);
    clock.advance(1_000 + WAKE_MARGIN_MS);
    expect(sent).toEqual(["u1", "u2"]);
    // La relance répond 503 aussitôt, « encore 1 s » : le réveil suivant attend la minute.
    wakes.note("u1", 1_000);
    expect(wakes.pendingFor("u1")).toBe(clock.now() + WAKE_MIN_GAP_MS);
    clock.advance(WAKE_MIN_GAP_MS);
    expect(sent).toEqual(["u1", "u2", "u1"]);
  });
});

describe("crochet sur les réponses", () => {
  async function serverWith(status: number, retryAfter: string | null, session: string | undefined) {
    const app = Fastify();
    const wakes = { note: vi.fn() };
    app.addHook("onResponse", async (request, reply) => noteExtensionWait(request, reply, wakes as never, ROUTE));
    app.addHook("preHandler", async (request) => {
      if (session) (request as never as { user: unknown }).user = { userId: "u1", username: "k", isAdmin: false, session };
    });
    app.get("/api/plugins/sillon/music/offline/:id", async (_request, reply) => {
      if (retryAfter) reply.header("retry-after", retryAfter);
      return reply.status(status).send({ preparing: status === 503 });
    });
    await app.inject({ url: "/api/plugins/sillon/music/offline/ytm%3At%3Ax" });
    await app.close();
    return wakes.note;
  }

  it("503 + Retry-After d'une session personnelle : le réveil est retenu", async () => {
    expect(await serverWith(503, "90", "personal")).toHaveBeenCalledWith("u1", 90_000);
  });

  it("ni un 200, ni un 503 sans Retry-After, ni une session de profil", async () => {
    expect(await serverWith(200, "90", "personal")).not.toHaveBeenCalled();
    expect(await serverWith(503, null, "personal")).not.toHaveBeenCalled();
    expect(await serverWith(503, "90", "tvProfile")).not.toHaveBeenCalled();
    expect(await serverWith(503, "90", undefined)).not.toHaveBeenCalled();
  });
});
