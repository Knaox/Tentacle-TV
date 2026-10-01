/**
 * La garde touche à la reprise d'un titre : se tromper, c'est faire reculer
 * une fiche qu'un autre appareil a fait avancer, ou réécrire chez Jellyfin une
 * position qu'il avait raison de garder. Chaque refus est donc éprouvé autant
 * que chaque correction.
 */
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { clearActivePlayback, setActivePlayback } from "../socket/sessionChannel";
import { adoptStop, findUserData, forgetRecentStops, rememberStop, type UserDataClient } from "./recentStopGuard";

const T = 10_000_000;
const ID = "robin";
const RUNTIME = 7314 * T;
const STOPPED_AT = Date.parse("2026-10-01T16:22:39.341Z");
const BEFORE = "2026-10-01T16:21:26.000Z"; // début de la lecture arrêtée
const AFTER = "2026-10-01T16:23:30.000Z"; // une lecture commencée depuis

function item(position: number, lastPlayed?: string, played = false): MediaItem {
  return {
    Id: ID, Name: "Robin", Type: "Movie", RunTimeTicks: RUNTIME,
    UserData: { PlaybackPositionTicks: position * T, PlayCount: 2, IsFavorite: false, Played: played, LastPlayedDate: lastPlayed },
  } as MediaItem;
}

function fakeClient(read: Record<string, unknown> | null): UserDataClient & { calls: Array<{ path: string; init?: RequestInit }> } {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  return {
    calls,
    fetch<R>(path: string, init?: RequestInit): Promise<R> {
      calls.push({ path, init });
      if (init?.method === "POST") return Promise.resolve(undefined as R);
      return read === null ? Promise.reject(new Error("réseau")) : Promise.resolve(read as R);
    },
  };
}

const stop = { itemId: ID, runtimeTicks: RUNTIME, positionTicks: 2411 * T, played: false, stoppedAt: STOPPED_AT };
const positionIn = (qc: QueryClient, key: unknown[]) => findUserData(qc.getQueryData(key), ID)?.PlaybackPositionTicks;

describe("la garde : une relecture plus ancienne ne fait plus reculer", () => {
  // L'horloge seule est figée, une seconde après l'arrêt : la garde vit deux
  // minutes, et les minuteurs de React Query restent réels.
  beforeEach(() => { forgetRecentStops(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(STOPPED_AT + 1_000); });
  afterEach(() => vi.useRealTimers());

  it("au-delà de deux minutes, la garde est tombée d'elle-même", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    vi.setSystemTime(STOPPED_AT + 121_000);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(0) });
    expect(positionIn(qc, ["item", ID])).toBe(0);
  });

  it("la fiche relue avant l'écriture de Jellyfin garde l'arrêt", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(0) });
    expect(positionIn(qc, ["item", ID])).toBe(2411 * T);
  });

  it("le cas mesuré — l'instantané du DÉBUT écrit en dernier — ne l'emporte pas", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(1826, BEFORE) });
    expect(positionIn(qc, ["item", ID])).toBe(2411 * T);
  });

  it("les listes aussi : « Reprendre la lecture »", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["resume-items"], queryFn: async () => [item(1826, BEFORE)] });
    expect(positionIn(qc, ["resume-items"])).toBe(2411 * T);
  });

  it("LA DATE GAGNE : une lecture commencée depuis fait tomber la garde", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(300, AFTER) });
    expect(positionIn(qc, ["item", ID])).toBe(300 * T);
    // Tombée : une réponse ancienne venue ensuite n'est plus corrigée non plus.
    await qc.fetchQuery({ queryKey: ["resume-items"], queryFn: async () => [item(0)] });
    expect(positionIn(qc, ["resume-items"])).toBe(0);
  });

  it("le serveur a écrit l'arrêt : sa réponse passe telle quelle", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(2412, BEFORE) });
    expect(positionIn(qc, ["item", ID])).toBe(2412 * T);
  });

  it("un accord passager ne lève pas la garde : l'écriture hors d'ordre qui suit est corrigée", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(2411, BEFORE) });
    await qc.fetchQuery({ queryKey: ["resume-items"], queryFn: async () => [item(1826, BEFORE)] });
    expect(positionIn(qc, ["resume-items"])).toBe(2411 * T);
  });

  it("les autres titres ne sont jamais touchés", async () => {
    const qc = new QueryClient();
    rememberStop(qc, fakeClient(null), "u1", stop);
    const other = { ...item(42), Id: "autre" } as MediaItem;
    await qc.fetchQuery({ queryKey: ["item", "autre"], queryFn: async () => other });
    expect((qc.getQueryData(["item", "autre"]) as MediaItem).UserData?.PlaybackPositionTicks).toBe(42 * T);
  });
});

describe("adoptStop — l'arrêt de cet appareil devient la vérité locale", () => {
  beforeEach(() => { forgetRecentStops(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(STOPPED_AT + 1_000); });
  afterEach(() => vi.useRealTimers());

  it("au milieu du titre : la fiche montre l'arrêt, et la garde le défend", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["item", ID], item(1826, BEFORE));
    const projection = adoptStop(qc, fakeClient(null), "u1", { itemId: ID, positionSeconds: 2411, runtimeTicks: RUNTIME, stoppedAt: STOPPED_AT });
    expect(projection).toEqual({ positionTicks: 2411 * T, played: false });
    expect(positionIn(qc, ["item", ID])).toBe(2411 * T);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(1826, BEFORE) });
    expect(positionIn(qc, ["item", ID])).toBe(2411 * T);
  });

  it("près du début : la fiche suit la règle de Jellyfin, sans garde", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["item", ID], item(1826, BEFORE));
    adoptStop(qc, fakeClient(null), "u1", { itemId: ID, positionSeconds: 200, runtimeTicks: RUNTIME, stoppedAt: STOPPED_AT });
    expect(positionIn(qc, ["item", ID])).toBe(0);
    await qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(1826, BEFORE) });
    expect(positionIn(qc, ["item", ID])).toBe(1826 * T);
  });

  it("durée inconnue : rien ne bouge", () => {
    const qc = new QueryClient();
    qc.setQueryData(["item", ID], item(1826, BEFORE));
    expect(adoptStop(qc, fakeClient(null), "u1", { itemId: ID, positionSeconds: 2411, runtimeTicks: undefined, stoppedAt: STOPPED_AT })).toBeNull();
    expect(positionIn(qc, ["item", ID])).toBe(1826 * T);
  });
});

describe("findUserData — toutes les formes de réponse", () => {
  it("fiche, liste, `{ Items }`, pages infinies ; rien ailleurs", () => {
    const ud = item(10).UserData;
    expect(findUserData(item(10), ID)).toEqual(ud);
    expect(findUserData([item(10)], ID)).toEqual(ud);
    expect(findUserData({ Items: [item(10)] }, ID)).toEqual(ud);
    expect(findUserData({ pages: [{ Items: [] }, { Items: [item(10)] }] }, ID)).toEqual(ud);
    expect(findUserData({ Items: [] }, ID)).toBeUndefined();
    expect(findUserData("texte", ID)).toBeUndefined();
  });
});

describe("la réparation : une seule réécriture, et seulement si le désaccord tient", () => {
  beforeEach(() => {
    forgetRecentStops();
    vi.useFakeTimers();
    vi.setSystemTime(STOPPED_AT + 1_000);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("Jellyfin n'a jamais écrit : la reprise est réécrite, objet entier, une fois", async () => {
    const read = { PlaybackPositionTicks: 1826 * T, Played: false, LastPlayedDate: BEFORE, PlayCount: 2, IsFavorite: true, Key: "k" };
    const client = fakeClient(read);
    rememberStop(new QueryClient(), client, "u 1", stop);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.calls.map((c) => c.init?.method ?? "GET")).toEqual(["GET", "POST"]);
    expect(client.calls[1].path).toBe(`/UserItems/${ID}/UserData?userId=u%201`);
    expect(JSON.parse(String(client.calls[1].init?.body))).toEqual({ ...read, PlaybackPositionTicks: 2411 * T, Played: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.calls).toHaveLength(2);
  });

  it("après un accord passager, la réparation revérifie : Jellyfin a reculé, elle réécrit", async () => {
    const client = fakeClient({ PlaybackPositionTicks: 1826 * T, Played: false, LastPlayedDate: BEFORE });
    const qc = new QueryClient();
    rememberStop(qc, client, "u1", stop);
    const fetched = qc.fetchQuery({ queryKey: ["item", ID], queryFn: async () => item(2411, BEFORE) });
    await vi.advanceTimersByTimeAsync(0);
    await fetched;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.calls.map((c) => c.init?.method ?? "GET")).toEqual(["GET", "POST"]);
  });

  it("une lecture commencée depuis (ailleurs) : aucune écriture", async () => {
    const client = fakeClient({ PlaybackPositionTicks: 300 * T, Played: false, LastPlayedDate: AFTER });
    rememberStop(new QueryClient(), client, "u1", stop);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.calls.map((c) => c.init?.method ?? "GET")).toEqual(["GET"]);
  });

  it("le serveur a fini par écrire : aucune écriture", async () => {
    const client = fakeClient({ PlaybackPositionTicks: 2411 * T, Played: false, LastPlayedDate: BEFORE });
    rememberStop(new QueryClient(), client, "u1", stop);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.calls.map((c) => c.init?.method ?? "GET")).toEqual(["GET"]);
  });

  it("le titre est relancé sur cet appareil : ni lecture ni écriture", async () => {
    const client = fakeClient({ PlaybackPositionTicks: 1826 * T, Played: false, LastPlayedDate: BEFORE });
    const provider = () => ({ itemId: ID }) as ReturnType<Parameters<typeof setActivePlayback>[0]>;
    setActivePlayback(provider);
    try {
      rememberStop(new QueryClient(), client, "u1", stop);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(client.calls).toHaveLength(0);
    } finally {
      clearActivePlayback(provider);
    }
  });

  it("un arrêt plus récent du même titre remplace l'ancien : seule sa propre réparation compte", async () => {
    const client = fakeClient({ PlaybackPositionTicks: 0, Played: false, LastPlayedDate: BEFORE });
    const qc = new QueryClient();
    rememberStop(qc, client, "u1", stop);
    await vi.advanceTimersByTimeAsync(5_000);
    rememberStop(qc, client, "u1", { ...stop, positionTicks: 2500 * T, stoppedAt: STOPPED_AT + 5_000 });
    await vi.advanceTimersByTimeAsync(20_000);
    const posts = client.calls.filter((c) => c.init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0].init?.body)).PlaybackPositionTicks).toBe(2500 * T);
  });
});
