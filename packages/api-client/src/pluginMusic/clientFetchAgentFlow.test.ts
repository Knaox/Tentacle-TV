import { afterEach, describe, expect, it, vi } from "vitest";

const socket = vi.hoisted(() => ({ listeners: new Set<(m: unknown) => void>(), released: 0, token: undefined as string | undefined }));
const api = vi.hoisted(() => ({ posts: [] as { path: string; body: unknown }[] }));

vi.mock("../socket/tentacleSocket", () => ({
  acquireSocket: (token?: string) => ((socket.token = token), () => void socket.released++),
  subscribeSocket: (l: (m: unknown) => void) => (socket.listeners.add(l), () => socket.listeners.delete(l)),
}));
vi.mock("../hooks/usePreferences", () => ({
  tentacleApiSession: () => ({ serverOrigin: "https://tentacle.example", headers: { Authorization: "Bearer t" } }),
  tentacleApiFetch: async (path: string, init: RequestInit) => (api.posts.push({ path, body: JSON.parse(String(init.body)) }), { ok: true }),
}));

import { startClientFetchAgent } from "./clientFetchAgent";
import { clientFetchAnnounceHeaders } from "./clientFetchAnnounce";

const job = { type: "plugin:clientFetch", id: "0b5c0f6e-2f1a-4a8e-9d55-2d8e4c1f7a10", pluginId: "sillon", request: { method: "POST", url: "https://music.example.com/x" } };
const emit = (m: unknown) => socket.listeners.forEach((l) => l(m));
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  socket.listeners.clear();
  api.posts.length = 0;
});

describe("requêtes déléguées — l'agent de la page, de la socket à la réponse", () => {
  it("passe le travail à l'exécuteur avec la session d'API, poste la réponse sous son identifiant, annonce tant qu'il tourne", async () => {
    const executor = vi.fn(async () => ({ ok: true as const, response: { status: 200, url: "https://music.example.com/x", headers: {}, body: "{}" } }));
    const stop = startClientFetchAgent(executor, "jeton");
    expect(socket.token).toBe("jeton");
    expect(clientFetchAnnounceHeaders("/api/plugins/sillon/music/resolve")).toEqual({ "x-tentacle-client-fetch": "1" });
    emit({ type: "music:pending", pluginId: "sillon" });
    emit(job);
    await flush();
    expect(executor).toHaveBeenCalledWith(job, { serverOrigin: "https://tentacle.example", headers: { Authorization: "Bearer t" } });
    expect(api.posts).toEqual([{ path: `/api/client-fetch/${job.id}`, body: { ok: true, response: { status: 200, url: "https://music.example.com/x", headers: {}, body: "{}" } } }]);
    stop();
    expect(socket.released).toBe(1);
    expect(clientFetchAnnounceHeaders("/api/plugins/sillon/music/resolve")).toEqual({});
  });

  it("un exécuteur qui lève rend « refused » : l'extension n'attend jamais en vain", async () => {
    const stop = startClientFetchAgent(async () => { throw new Error("pont absent"); });
    emit(job);
    await flush();
    expect(api.posts[0]?.body).toEqual({ ok: false, reason: "refused" });
    stop();
  });
});
