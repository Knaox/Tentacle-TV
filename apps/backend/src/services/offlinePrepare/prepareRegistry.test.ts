/**
 * La préparation tenue par le serveur, de bout en bout sur un vrai disque : le
 * serveur écrit sans attendre personne, un lecteur suit le fichier qui grandit,
 * une reprise repart d'une plage, l'abandon efface.
 *
 * Jellyfin est remplacé par un flux qu'on alimente à la main.
 */

import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PrepareJob } from "./prepareJob";
import { PrepareRegistry } from "./prepareRegistry";
import { runPreparation } from "./prepareRunner";
import { PreparedTail } from "./prepareTail";

/** Un faux Jellyfin : on pousse des morceaux, on termine ou on coupe. */
function fakeUpstream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  let aborted = false;
  return {
    open: async (signal: AbortSignal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        controller?.error(new Error("abandon"));
      });
      return new Response(body, { status: 200 });
    },
    push: (text: string) => controller?.enqueue(new TextEncoder().encode(text)),
    end: () => controller?.close(),
    fail: () => controller?.error(new Error("jellyfin coupé")),
    aborted: () => aborted,
  };
}

function setup() {
  const dir = join(mkdtempSync(join(tmpdir(), "tentacle-prepare-")), "offline-prepare");
  let clock = 1_000;
  const registry = new PrepareRegistry(dir, () => clock);
  const upstream = fakeUpstream();
  const ready: PrepareJob[] = [];
  const job = registry.acquire("cle", "u1", "item", (started) => {
    void runPreparation(started, upstream.open, () => clock, (done) => ready.push(done));
  });
  return { dir, registry, upstream, job, ready, advance: (ms: number) => (clock += ms) };
}

async function collect(tail: PreparedTail): Promise<string> {
  let text = "";
  for await (const chunk of tail) text += Buffer.from(chunk as Buffer).toString();
  return text;
}

describe("le serveur prépare seul", () => {
  it("un lecteur suit le fichier qui grandit, du premier au dernier octet", async () => {
    const { registry, upstream, job, ready } = setup();
    const tail = new PreparedTail(job, 0, (closed) => registry.settle(closed));
    const reading = collect(tail);
    upstream.push("abc");
    await vi.waitFor(() => expect(job.bytes).toBe(3));
    upstream.push("defg");
    upstream.end();
    expect(await reading).toBe("abcdefg");
    expect(job.state).toBe("done");
    expect(existsSync(job.finalPath)).toBe(true);
    expect(existsSync(job.partPath)).toBe(false);
    expect(ready).toHaveLength(1);
  });

  it("sans lecteur, la préparation avance quand même, puis se lit d'une plage", async () => {
    const { registry, upstream, job } = setup();
    upstream.push("0123456789");
    upstream.end();
    await vi.waitFor(() => expect(job.state).toBe("done"));
    const tail = new PreparedTail(job, 4, (closed) => registry.settle(closed));
    expect(await collect(tail)).toBe("456789");
  });

  it("la même demande rend la même préparation, jamais une seconde", () => {
    const { registry, job } = setup();
    const again = registry.acquire("cle", "u1", "item", () => {
      throw new Error("relancée");
    });
    expect(again).toBe(job);
  });

  it("Jellyfin coupé : le lecteur voit une coupure, et la redemande relance une préparation neuve", async () => {
    const { registry, upstream, job } = setup();
    const tail = new PreparedTail(job, 0, (closed) => registry.settle(closed));
    const reading = collect(tail);
    upstream.push("abc");
    await vi.waitFor(() => expect(job.bytes).toBe(3));
    upstream.fail();
    await expect(reading).rejects.toThrow();
    expect(job.state).toBe("failed");
    const fresh = registry.acquire("cle", "u1", "item", () => undefined);
    expect(fresh).not.toBe(job);
  });
});

describe("l'abandon", () => {
  it("relâchée en cours de route sans lecteur : Jellyfin est coupé et rien ne reste", async () => {
    const { dir, registry, upstream, job } = setup();
    upstream.push("abc");
    await vi.waitFor(() => expect(job.bytes).toBe(3));
    registry.release("cle");
    await vi.waitFor(() => expect(job.state).toBe("failed"));
    expect(upstream.aborted()).toBe(true);
    expect(registry.find("cle")).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  });

  it("relâchée sous un lecteur : le fichier reste jusqu'à son départ", async () => {
    const { registry, upstream, job } = setup();
    upstream.push("abcdef");
    upstream.end();
    await vi.waitFor(() => expect(job.state).toBe("done"));
    const tail = new PreparedTail(job, 0, (closed) => registry.settle(closed));
    registry.release("cle");
    expect(existsSync(job.finalPath)).toBe(true);
    expect(await collect(tail)).toBe("abcdef");
    await vi.waitFor(() => expect(existsSync(job.finalPath)).toBe(false));
  });

  it("le balayage efface une préparation prête oubliée depuis une journée", async () => {
    const { registry, upstream, job, advance } = setup();
    upstream.push("abc");
    upstream.end();
    await vi.waitFor(() => expect(job.state).toBe("done"));
    advance(23 * 60 * 60 * 1000);
    expect(registry.sweep()).toBe(0);
    advance(60 * 60 * 1000);
    expect(registry.sweep()).toBe(1);
    expect(existsSync(job.finalPath)).toBe(false);
  });
});
