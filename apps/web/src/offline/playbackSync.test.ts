import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Défaut E du relevé : une série vue AILLEURS repartait à l'épisode 1 sur le
 * bureau, qui ne faisait que pousser sa progression. Il la tire désormais :
 * l'état du serveur est lu, puis remis à la coquille (`downloads_playback_reconcile`),
 * qui ne l'applique que s'il est plus récent que le local.
 */

interface Call {
  command: string;
  args: Record<string, unknown>;
}

const state = vi.hoisted(() => ({
  commands: ["downloads_list", "downloads_playback_reconcile"] as string[],
  calls: [] as Call[],
  list: [] as Array<{ itemId: string; status: string }>,
  pending: [] as Array<{ id: number; itemId: string; positionTicks: number; played: boolean; occurredAtUtc: number }>,
  changed: [] as string[],
}));

vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur" }));
vi.mock("../desktop/bridge", () => ({
  supportsDownloads: () => state.commands.includes("downloads_list"),
  invoke: async (command: string, args: Record<string, unknown>) => {
    state.calls.push({ command, args });
    if (command === "downloads_list") return state.list;
    if (command === "downloads_reports_pending") return state.pending;
    if (command === "downloads_playback_reconcile") return state.changed;
    return null;
  },
  listen: async () => () => undefined,
}));
vi.mock("../desktop/capabilities", () => ({
  supportsPlaybackReconcile: () => state.commands.includes("downloads_playback_reconcile"),
}));

const { freshlyKept, isWatchedGestureSuccess, resetPlaybackSync, syncPlaybackState } = await import("./playbackSync");

const requests: Array<{ url: string; method: string }> = [];
let serverItems: unknown[] = [];
let readStatus = 200;

beforeEach(() => {
  state.commands = ["downloads_list", "downloads_playback_reconcile"];
  state.calls = [];
  state.list = [];
  state.pending = [];
  state.changed = [];
  requests.length = 0;
  serverItems = [];
  readStatus = 200;
  resetPlaybackSync();
  vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "tentacle_token" ? "jeton" : null) });
  vi.stubGlobal("fetch", async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    requests.push({ url, method });
    if (method === "GET") return { ok: readStatus === 200, status: readStatus, json: async () => ({ Items: serverItems }) };
    return { ok: true, status: 204, json: async () => ({}) };
  });
});

const reconciled = () => state.calls.find((call) => call.command === "downloads_playback_reconcile")?.args;

describe("syncPlaybackState", () => {
  it("tire l'état du serveur pour les titres gardés : les épisodes vus ailleurs le deviennent ici", async () => {
    state.list = [
      { itemId: "e1", status: "complete" },
      { itemId: "e2", status: "complete" },
      { itemId: "e3", status: "downloading" },
    ];
    serverItems = [
      { Id: "e1", UserData: { Played: true, PlaybackPositionTicks: 0, LastPlayedDate: "2026-11-01T20:00:00.000Z" } },
      { Id: "e2", UserData: { Played: false, PlaybackPositionTicks: 6_000, LastPlayedDate: "2026-11-02T20:00:00.000Z" } },
    ];
    state.changed = ["e1", "e2"];

    const result = await syncPlaybackState("moi", "all");

    expect(requests[0]?.url).toBe("http://serveur/api/jellyfin/Users/moi/Items?ids=e1,e2&enableUserData=true");
    expect(reconciled()).toEqual({
      userId: "moi",
      entries: [
        { itemId: "e1", played: true, positionTicks: 0, lastPlayedAtMs: Date.parse("2026-11-01T20:00:00.000Z") },
        { itemId: "e2", played: false, positionTicks: 6_000, lastPlayedAtMs: Date.parse("2026-11-02T20:00:00.000Z") },
      ],
      pendingItemIds: [],
    });
    expect(result).toEqual({ pushed: 0, pulled: 2 });
  });

  it("ne pousse pas un rapport que le serveur a dépassé, pousse les autres", async () => {
    state.list = [{ itemId: "a", status: "complete" }, { itemId: "b", status: "complete" }];
    state.pending = [
      { id: 1, itemId: "a", positionTicks: 100, played: false, occurredAtUtc: Date.parse("2026-11-01T10:00:00.000Z") },
      { id: 2, itemId: "b", positionTicks: 200, played: false, occurredAtUtc: Date.parse("2026-11-03T10:00:00.000Z") },
    ];
    serverItems = [
      { Id: "a", UserData: { Played: true, LastPlayedDate: "2026-11-02T10:00:00.000Z" } },
      { Id: "b", UserData: { Played: false, PlaybackPositionTicks: 50, LastPlayedDate: "2026-11-02T10:00:00.000Z" } },
    ];

    const result = await syncPlaybackState("moi", "all");

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts.map((request) => request.url)).toEqual(["http://serveur/api/jellyfin/UserItems/b/UserData"]);
    const synced = state.calls.filter((call) => call.command === "downloads_reports_mark_synced").map((call) => call.args.itemId);
    expect(synced).toEqual(["a", "b"]);
    expect(result.pushed).toBe(1);
  });

  it("un seul titre : celui qui vient d'arriver sur la machine", async () => {
    state.list = [{ itemId: "a", status: "complete" }, { itemId: "b", status: "complete" }];
    await syncPlaybackState("moi", ["b"]);
    expect(requests[0]?.url).toContain("ids=b&");
  });

  it("lecture du serveur en échec : rien n'est appliqué, rien ne lève", async () => {
    state.list = [{ itemId: "a", status: "complete" }];
    readStatus = 503;
    await expect(syncPlaybackState("moi", "all")).resolves.toEqual({ pushed: 0, pulled: 0 });
    expect(reconciled()).toBeUndefined();
  });

  it("coquille d'avant (sans la commande) : on pousse comme avant, sans rien lire", async () => {
    state.commands = ["downloads_list"];
    state.list = [{ itemId: "a", status: "complete" }];
    state.pending = [{ id: 1, itemId: "a", positionTicks: 100, played: false, occurredAtUtc: 5 }];
    const result = await syncPlaybackState("moi", "all");
    expect(requests.every((request) => request.method === "POST")).toBe(true);
    expect(result).toEqual({ pushed: 1, pulled: 0 });
  });

  it("le tour complet ne se refait pas avant une minute, sauf s'il est forcé", async () => {
    state.list = [{ itemId: "a", status: "complete" }];
    await syncPlaybackState("moi", "all");
    await syncPlaybackState("moi", "all");
    expect(requests.filter((request) => request.method === "GET")).toHaveLength(1);
    await syncPlaybackState("moi", "all", { force: true });
    expect(requests.filter((request) => request.method === "GET")).toHaveLength(2);
  });
});

describe("freshlyKept", () => {
  it("ne rend que les titres arrivés depuis le relevé précédent", () => {
    expect(freshlyKept(null, new Set(["a"]))).toEqual([]);
    expect(freshlyKept(new Set(["a"]), new Set(["a", "b"]))).toEqual(["b"]);
    expect(freshlyKept(new Set(["a", "b"]), new Set(["a"]))).toEqual([]);
  });
});

describe("isWatchedGestureSuccess", () => {
  it("ne reconnaît que la réussite d'une bascule « vu »", () => {
    const event = (type: string, meta?: Record<string, unknown>) => ({ type: "updated", action: { type }, mutation: { options: { meta } } });
    expect(isWatchedGestureSuccess(event("success", { userDataGesture: "watched" }))).toBe(true);
    expect(isWatchedGestureSuccess(event("error", { userDataGesture: "watched" }))).toBe(false);
    expect(isWatchedGestureSuccess(event("success", { failureTitle: "errors:toastFavoriteFailed" }))).toBe(false);
    expect(isWatchedGestureSuccess({ type: "added" })).toBe(false);
  });
});
