/**
 * Le canal vers l'hôte Windows, sur un faux port : muet sans hôte, l'arrêt
 * sur demande ou canal perdu, `status` servi, et les questions du serveur
 * limitées à ce que l'hôte a annoncé.
 */

import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostChannel, HostRequestError, type HostChannelHandlers, type HostPort } from "./hostChannel";

class FakePort extends EventEmitter implements HostPort {
  sent: unknown[] = [];
  connected = true;
  send = (message: unknown, callback?: (error: Error | null) => void) => {
    this.sent.push(message);
    callback?.(null);
    return true;
  };
}

const STATUS = { bootId: "boot", appState: "running", playbackActive: false, restartPending: false };

function handlers(): HostChannelHandlers & { shutdown: ReturnType<typeof vi.fn> } {
  return { shutdown: vi.fn(), status: vi.fn(async () => STATUS) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createHostChannel", () => {
  it("sans canal IPC (Docker), aucun canal", () => {
    const port = new EventEmitter() as unknown as HostPort;
    expect(createHostChannel(port, handlers())).toBeNull();
  });

  it("tentacle:shutdown et la perte du canal mènent à l'arrêt", () => {
    const port = new FakePort();
    const h = handlers();
    createHostChannel(port, h);
    port.emit("message", { type: "tentacle:shutdown", reason: "session-end" });
    expect(h.shutdown).toHaveBeenCalledWith("session-end");
    port.emit("disconnect");
    expect(h.shutdown).toHaveBeenLastCalledWith("host-gone");
  });

  it("répond à status, et unknown_method à une méthode d'un hôte plus récent", async () => {
    const port = new FakePort();
    createHostChannel(port, handlers());
    port.emit("message", { type: "tentacle:request", id: "1", method: "status" });
    port.emit("message", { type: "tentacle:request", id: "2", method: "future" });
    await vi.waitFor(() => expect(port.sent).toHaveLength(2));
    expect(port.sent).toContainEqual({ type: "tentacle:response", id: "1", ok: true, result: STATUS });
    expect(port.sent).toContainEqual({ type: "tentacle:response", id: "2", ok: false, error: "unknown_method" });
  });

  it("ignore un message inconnu", () => {
    const port = new FakePort();
    const h = handlers();
    createHostChannel(port, h);
    port.emit("message", { type: "tentacle:later", whatever: true });
    port.emit("message", "texte");
    expect(h.shutdown).not.toHaveBeenCalled();
    expect(port.sent).toEqual([]);
  });

  it("ne demande à l'hôte que ce qu'il a annoncé, et lit sa réponse", async () => {
    const port = new FakePort();
    const channel = createHostChannel(port, handlers());
    await expect(channel?.request("pickFolder")).rejects.toEqual(new HostRequestError("unknown_method"));
    port.emit("message", { type: "tentacle:host-hello", protocol: 1, hostVersion: "1.0.0", methods: ["pickFolder"] });
    expect(channel?.supports("pickFolder")).toBe(true);
    const answer = channel?.request("pickFolder", { start: "D:\\" });
    const sent = port.sent.at(-1) as { id: string; method: string; params: unknown };
    expect(sent).toMatchObject({ type: "tentacle:request", method: "pickFolder", params: { start: "D:\\" } });
    port.emit("message", { type: "tentacle:response", id: sent.id, ok: true, result: { path: "D:\\Films" } });
    await expect(answer).resolves.toEqual({ path: "D:\\Films" });
  });

  it("une question sans réponse expire", async () => {
    vi.useFakeTimers();
    const port = new FakePort();
    const channel = createHostChannel(port, handlers());
    port.emit("message", { type: "tentacle:host-hello", protocol: 1, methods: ["pickFolder"] });
    const answer = channel?.request("pickFolder", undefined, 1000);
    const check = expect(answer).rejects.toEqual(new HostRequestError("timeout"));
    await vi.advanceTimersByTimeAsync(1000);
    await check;
  });

  it("canal fermé : rien n'est envoyé", () => {
    const port = new FakePort();
    const channel = createHostChannel(port, handlers());
    port.connected = false;
    void channel?.notify({ type: "tentacle:restarting", detail: "x" });
    expect(port.sent).toEqual([]);
  });
});
