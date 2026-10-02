import { describe, expect, it, vi } from "vitest";
import { NO_QUALITY_BADGES, type MediaItem, type MediaStream } from "@tentacle-tv/shared";
import { createQualityBadgeStore } from "./qualityBadgeStore";

const uhdHdr: MediaStream[] = [{ Type: "Video", Codec: "hevc", Index: 0, IsDefault: true, Width: 3840, Height: 2160, VideoRangeType: "HDR10" }];
const item = (id: string, streams?: MediaStream[]): MediaItem => ({ Id: id, Name: id, Type: "Movie", ...(streams ? { MediaStreams: streams } : {}) }) as MediaItem;
const labels = (badges: ReturnType<ReturnType<typeof createQualityBadgeStore>["peek"]>) => badges?.map((b) => b.label);

/** Une lecture qu'on résout ou qu'on fait échouer à la main. */
function deferredLoad() {
  const calls: Array<{ id: string; resolve: (item: MediaItem | undefined) => void; reject: (error: Error) => void }> = [];
  const load = vi.fn((id: string) => new Promise<MediaItem | undefined>((resolve, reject) => calls.push({ id, resolve, reject })));
  return { load, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createQualityBadgeStore", () => {
  it("un titre inconnu : rien, puis UNE lecture, puis ses badges, et l'abonné prévenu", async () => {
    const { load, calls } = deferredLoad();
    const store = createQualityBadgeStore({ load });
    const onChange = vi.fn();
    store.subscribe("a", onChange);
    expect(store.peek("a")).toBeUndefined();
    store.request("a");
    store.request("a");
    expect(load).toHaveBeenCalledTimes(1);
    calls[0].resolve(item("a", uhdHdr));
    await flush();
    expect(labels(store.peek("a"))).toEqual(["4K", "HDR10"]);
    expect(onChange).toHaveBeenCalledTimes(1);
    store.request("a");
    expect(load).toHaveBeenCalledTimes(1);
    expect(store.stats()).toEqual({ requests: 1, failures: 0, known: 1 });
  });

  it("la fiche en cache dit la qualité sans requête", () => {
    const { load } = deferredLoad();
    const fiche = { ...item("a"), MediaSources: [{ Id: "s", Name: "s", Container: "mkv", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true, MediaStreams: uhdHdr }] } as MediaItem;
    const store = createQualityBadgeStore({ load, peekItem: (id) => (id === "a" ? fiche : item(id)) });
    expect(labels(store.peek("a"))).toEqual(["4K", "HDR10"]);
    store.request("a");
    expect(load).not.toHaveBeenCalled();
    // Un item en cache SANS ses flux ne dit rien : il faut le lire.
    expect(store.peek("b")).toBeUndefined();
    store.request("b");
    expect(load).toHaveBeenCalledWith("b");
  });

  it("un titre disparu, ou rendu sans ses flux : connu, sans badge, jamais redemandé", async () => {
    const { load, calls } = deferredLoad();
    const store = createQualityBadgeStore({ load });
    store.request("gone");
    store.request("bare");
    calls[0].resolve(undefined);
    calls[1].resolve(item("bare"));
    await flush();
    expect(store.peek("gone")).toBe(NO_QUALITY_BADGES);
    expect(store.peek("bare")).toBe(NO_QUALITY_BADGES);
    store.request("gone");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("un échec ne se garde pas, et suspend les lectures un moment", async () => {
    const { load, calls } = deferredLoad();
    let clock = 1_000;
    const store = createQualityBadgeStore({ load, now: () => clock, failureCooldownMs: 15_000 });
    store.request("a");
    calls[0].reject(new Error("Network error"));
    await flush();
    expect(store.peek("a")).toBeUndefined();
    store.request("a");
    store.request("b");
    expect(load).toHaveBeenCalledTimes(1);
    clock += 15_000;
    store.request("a");
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.stats().failures).toBe(1);
  });

  it("désabonné, on n'est plus prévenu", async () => {
    const { load, calls } = deferredLoad();
    const store = createQualityBadgeStore({ load });
    const onChange = vi.fn();
    const unsubscribe = store.subscribe("a", onChange);
    store.request("a");
    unsubscribe();
    calls[0].resolve(item("a", uhdHdr));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(labels(store.peek("a"))).toEqual(["4K", "HDR10"]);
  });

  it("au-delà de `maxKnown` titres, les plus anciens s'en vont", async () => {
    const { load, calls } = deferredLoad();
    const store = createQualityBadgeStore({ load, maxKnown: 2 });
    for (const id of ["a", "b", "c"]) store.request(id);
    calls.forEach((call) => call.resolve(item(call.id, uhdHdr)));
    await flush();
    expect(store.peek("a")).toBeUndefined();
    expect(store.peek("b")).toBeDefined();
    expect(store.peek("c")).toBeDefined();
    expect(store.stats().known).toBe(2);
  });
});
