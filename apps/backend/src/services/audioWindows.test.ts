/**
 * Les fenêtres d'audio : leur géométrie, l'URL qui les demande, et la lecture
 * bornée qui coupe net puis libère l'encodage de Jellyfin.
 */

import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIO_BYTES_PER_SECOND,
  activeEncodingUrl,
  analysisWindows,
  audioStreamUrl,
  fetchAudioWindowToFile,
  headWindowMs,
  tailWindowMs,
  windowByteBudget,
} from "./audioWindows";

const MIN = 60_000;

describe("la géométrie des fenêtres", () => {
  it("20 % de la durée, entre les planchers et les plafonds", () => {
    expect(headWindowMs(24 * MIN)).toBe(5 * MIN);
    expect(tailWindowMs(24 * MIN)).toBe(6 * MIN);
    expect(headWindowMs(40 * MIN)).toBe(8 * MIN);
    expect(tailWindowMs(40 * MIN)).toBe(8 * MIN);
    expect(headWindowMs(90 * MIN)).toBe(10 * MIN);
    expect(tailWindowMs(90 * MIN)).toBe(10 * MIN);
  });

  it("un fichier de quatre minutes : la tête et la queue sont le fichier entier", () => {
    const { head, tail } = analysisWindows(4 * MIN);
    expect(head).toEqual({ kind: "head", startMs: 0, lengthMs: 4 * MIN });
    expect(tail).toEqual({ kind: "tail", startMs: 0, lengthMs: 4 * MIN });
  });

  it("la queue commence à la fin moins sa longueur", () => {
    const { tail } = analysisWindows(1_420_000);
    expect(tail).toEqual({ kind: "tail", startMs: 1_420_000 - 6 * MIN, lengthMs: 6 * MIN });
  });

  it("le budget d'octets suit le débit, avec la marge et l'en-tête", () => {
    expect(windowByteBudget(6 * MIN)).toBe(Math.ceil(360 * AUDIO_BYTES_PER_SECOND * 1.1) + 65_536);
  });
});

describe("les URL", () => {
  it("demande un MP3 mono à 64 kbit/s, depuis le point voulu, sur la bonne source, avec sa session", () => {
    expect(audioStreamUrl("http://jf.test", "ep-1", "src-1", 1_000_000, "psid-1")).toBe(
      "http://jf.test/Audio/ep-1/stream.mp3?audioCodec=mp3&audioBitRate=64000&audioChannels=1" +
        "&startTimeTicks=10000000000&mediaSourceId=src-1&DeviceId=tentacle-audio-analysis&PlaySessionId=psid-1",
    );
    expect(audioStreamUrl("http://jf.test", "ep-1", null, 0, "psid-2")).not.toContain("mediaSourceId");
  });

  it("libère l'encodage de la même session, sur le même appareil", () => {
    expect(activeEncodingUrl("http://jf.test", "psid-1")).toBe(
      "http://jf.test/Videos/ActiveEncodings?deviceId=tentacle-audio-analysis&playSessionId=psid-1",
    );
  });
});

describe("fetchAudioWindowToFile", () => {
  let dir = "";
  let calls: Array<{ url: string; method: string }> = [];
  let cancelled = 0;

  const chunk = (size: number) => new Uint8Array(size).fill(1);

  /** Un flux qui ne finit jamais — comme la tête chez Jellyfin. */
  const endlessStream = () =>
    new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk(65_536));
      },
      cancel() {
        cancelled++;
      },
    });

  const finiteStream = (chunks: Uint8Array[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });

  const stubFetch = (
    body: () => ReadableStream<Uint8Array> | null,
    status = 200,
    reject = false,
  ) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET" });
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        if (reject) throw new Error("réseau coupé");
        return new Response(body(), { status });
      }),
    );
  };

  const request = (window: { kind: "head" | "tail"; startMs: number; lengthMs: number }, clock?: () => number) => ({
    jellyfinUrl: "http://jf.test",
    apiKey: "k",
    itemId: "ep-1",
    mediaSourceId: "src-1",
    window,
    filePath: join(dir, `${window.kind}.mp3`),
    ...(clock ? { clock } : {}),
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tentacle-audio-test-"));
    calls = [];
    cancelled = 0;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(dir, { recursive: true, force: true });
  });

  it("la tête s'arrête au budget, annule le flux et libère l'encodage de la même session", async () => {
    stubFetch(endlessStream);
    const window = { kind: "head" as const, startMs: 0, lengthMs: 10_000 };
    const result = await fetchAudioWindowToFile(request(window));
    expect(result).toMatchObject({ ok: true, complete: false });
    if (!result.ok) throw new Error("attendu ok");
    expect(result.bytes).toBeGreaterThanOrEqual(windowByteBudget(10_000));
    expect((await readFile(join(dir, "head.mp3"))).length).toBe(result.bytes);
    expect(cancelled).toBe(1);

    const get = calls.find((c) => c.method === "GET");
    const del = calls.find((c) => c.method === "DELETE");
    const session = /PlaySessionId=([^&]+)/.exec(get?.url ?? "")?.[1];
    expect(session).toBeTruthy();
    expect(del?.url).toBe(activeEncodingUrl("http://jf.test", session as string));
  });

  it("la queue finit d'elle-même : complète, tous les octets écrits", async () => {
    stubFetch(() => finiteStream([chunk(1000), chunk(500)]));
    const result = await fetchAudioWindowToFile(request({ kind: "tail", startMs: 1_000_000, lengthMs: 360_000 }));
    expect(result).toMatchObject({ ok: true, complete: true, bytes: 1500 });
    expect((await readFile(join(dir, "tail.mp3"))).length).toBe(1500);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("un 404 dit « le serveur ne sait pas faire », un 500 ou le réseau coupé disent « transitoire »", async () => {
    stubFetch(() => null, 404);
    expect(await fetchAudioWindowToFile(request({ kind: "tail", startMs: 0, lengthMs: 1000 }))).toEqual({
      ok: false, failure: "not-supported", status: 404,
    });
    stubFetch(() => null, 500);
    expect(await fetchAudioWindowToFile(request({ kind: "tail", startMs: 0, lengthMs: 1000 }))).toEqual({
      ok: false, failure: "transient", status: 500,
    });
    stubFetch(() => null, 200, true);
    expect(await fetchAudioWindowToFile(request({ kind: "tail", startMs: 0, lengthMs: 1000 }))).toEqual({
      ok: false, failure: "transient",
    });
  });

  it("un serveur à moins de dix fois le temps réel est coupé, pas attendu", async () => {
    let t = 0;
    const clock = () => t;
    stubFetch(() =>
      new ReadableStream<Uint8Array>({
        pull(controller) {
          t += 11_000; // onze secondes pour 100 octets : à genoux
          controller.enqueue(chunk(100));
        },
        cancel() {
          cancelled++;
        },
      }),
    );
    const result = await fetchAudioWindowToFile(request({ kind: "head", startMs: 0, lengthMs: 600_000 }, clock));
    expect(result).toEqual({ ok: false, failure: "too-slow" });
    expect(cancelled).toBe(1);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });
});
