/**
 * Le flux étranglé : les octets sortent intacts et dans l'ordre, en blocs
 * bornés, au rythme des ticks ; sans plafond tout passe d'un coup ; une
 * destruction libère la part et détruit l'amont.
 */

import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BandwidthArbiter, MAX_BLOCK } from "./arbiter";
import type { BandwidthCaps } from "./caps";
import { ThrottledReadable } from "./throttledStream";

const MIB = 1024 * 1024;
const TICK_BUDGET = Math.floor((MIB * 100) / 1000);

let clock: number;
let caps: BandwidthCaps;
let arbiter: BandwidthArbiter;

/** Un corps reconnaissable, en deux chunks de 100 Kio. */
function body(): { whole: Buffer; parts: Buffer[] } {
  const whole = Buffer.alloc(200 * 1024);
  for (let i = 0; i < whole.length; i++) whole[i] = i % 251;
  return { whole, parts: [whole.subarray(0, 100 * 1024), whole.subarray(100 * 1024)] };
}

/** Laisse la pompe (promesses, `data`) faire son travail — minuteurs réels. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

function tick(): void {
  clock += 100;
  arbiter.tick();
}

function collect(stream: Readable): { chunks: Buffer[]; received: () => number } {
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  return { chunks, received: () => chunks.reduce((sum, chunk) => sum + chunk.length, 0) };
}

beforeEach(() => {
  // Seul l'intervalle de l'arbitre est factice : la pompe a besoin de vrais
  // minuteurs pour être attendue.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  clock = 1_000;
  caps = { internal: MIB, external: MIB };
  arbiter = new BandwidthArbiter(() => caps, { now: () => clock });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ThrottledReadable", () => {
  it("livre les octets intacts, en blocs bornés, au rythme des ticks", async () => {
    const { whole, parts } = body();
    const out = new ThrottledReadable(Readable.from(parts), arbiter.register("a", "internal"));
    const ended = new Promise<void>((resolve) => out.on("end", resolve));
    const { chunks, received } = collect(out);

    await settle();
    expect(received()).toBeGreaterThan(0); // le premier bloc part sans tick
    expect(received()).toBeLessThanOrEqual(MAX_BLOCK);

    tick();
    await settle();
    expect(received()).toBeLessThanOrEqual(MAX_BLOCK + TICK_BUDGET);
    expect(received()).toBeLessThan(whole.length);

    tick();
    await settle();
    await ended;
    expect(received()).toBe(whole.length);
    expect(Buffer.concat(chunks).equals(whole)).toBe(true);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(MAX_BLOCK);
    expect(arbiter.snapshot().internal.flows).toBe(0); // fin normale = part rendue
  });

  it("sans plafond, tout passe sans attendre un tick", async () => {
    caps = { internal: null, external: null };
    const { whole, parts } = body();
    const out = new ThrottledReadable(Readable.from(parts), arbiter.register("a", "external"));
    const ended = new Promise<void>((resolve) => out.on("end", resolve));
    const { chunks } = collect(out);
    await ended;
    expect(Buffer.concat(chunks).equals(whole)).toBe(true);
  });

  it("détruire le flux rend la part et détruit l'amont", async () => {
    const { parts } = body();
    const upstream = Readable.from(parts);
    const out = new ThrottledReadable(upstream, arbiter.register("a", "internal"));
    const closed = new Promise<void>((resolve) => out.on("close", resolve));
    collect(out);
    await settle();
    expect(arbiter.snapshot().internal.flows).toBe(1);
    out.destroy();
    await closed;
    expect(arbiter.snapshot().internal.flows).toBe(0);
    expect(upstream.destroyed).toBe(true);
  });

  it("une erreur amont remonte à l'aval, et la part est rendue", async () => {
    const upstream = new Readable({ read() {} });
    const out = new ThrottledReadable(upstream, arbiter.register("a", "internal"));
    const failed = new Promise<Error>((resolve) => out.on("error", resolve));
    collect(out);
    upstream.push(Buffer.alloc(1024));
    await settle();
    upstream.destroy(new Error("boom"));
    const error = await failed;
    expect(error.message).toContain("boom");
    expect(arbiter.snapshot().internal.flows).toBe(0);
  });
});
