import { randomUUID } from "crypto";
import {
  parseHostMessage, type HostProtocolError, type RequestMessage, type ServerStatus, type ServerToHostMessage,
  type ShutdownReason,
} from "./hostProtocol";

/**
 * Le canal IPC vers l'hôte qui supervise le serveur (app Windows). Il n'existe
 * que si le processus a été lancé avec un canal (`process.send`) : sous Docker
 * ou à la main, tout ici est muet et le serveur se comporte comme avant.
 * Protocole : `hostProtocol.ts` (recopié de shared).
 */
export interface HostPort {
  send?: (message: unknown, callback: (error: Error | null) => void) => boolean;
  connected?: boolean;
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "disconnect", listener: () => void): unknown;
}

export interface HostChannelHandlers {
  /** `tentacle:shutdown`, ou le canal perdu (`host-gone`) : l'hôte n'est plus là pour superviser. */
  shutdown: (reason: ShutdownReason | "host-gone") => void;
  status: () => Promise<ServerStatus>;
}

export interface HostChannel {
  /** Résolue une fois le message parti (à attendre avant une sortie), jamais rejetée. */
  notify: (message: ServerToHostMessage) => Promise<void>;
  /** L'hôte a-t-il annoncé cette méthode dans son bonjour ? */
  supports: (method: string) => boolean;
  /** Une question à l'hôte ; rejetée par une `HostRequestError` (méthode absente, délai…). */
  request: (method: string, params?: unknown, timeoutMs?: number) => Promise<unknown>;
}

export class HostRequestError extends Error {
  constructor(readonly code: HostProtocolError) {
    super(`[host] ${code}`);
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function createHostChannel(port: HostPort, handlers: HostChannelHandlers): HostChannel | null {
  if (typeof port.send !== "function") return null;
  const send = (message: unknown): Promise<void> =>
    new Promise((resolve) => {
      if (port.connected === false) return resolve();
      try {
        port.send?.(message, () => resolve());
      } catch {
        /* canal fermé entre-temps : l'hôte est parti, l'arrêt suit */
        resolve();
      }
    });
  let hostMethods: ReadonlySet<string> = new Set();
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  const answer = async (request: RequestMessage) => {
    if (request.method !== "status") {
      void send({ type: "tentacle:response", id: request.id, ok: false, error: "unknown_method" });
      return;
    }
    try {
      void send({ type: "tentacle:response", id: request.id, ok: true, result: await handlers.status() });
    } catch {
      void send({ type: "tentacle:response", id: request.id, ok: false, error: "failed" });
    }
  };

  port.on("message", (raw) => {
    const message = parseHostMessage(raw);
    if (!message) return;
    switch (message.type) {
      case "tentacle:host-hello":
        hostMethods = new Set(message.methods);
        return;
      case "tentacle:shutdown":
        handlers.shutdown(message.reason);
        return;
      case "tentacle:request":
        void answer(message);
        return;
      case "tentacle:response": {
        const waiting = pending.get(message.id);
        if (!waiting) return;
        pending.delete(message.id);
        clearTimeout(waiting.timer);
        if (message.ok) waiting.resolve(message.result);
        else waiting.reject(new HostRequestError(message.error));
        return;
      }
    }
  });
  port.on("disconnect", () => {
    for (const [id, waiting] of pending) {
      clearTimeout(waiting.timer);
      waiting.reject(new HostRequestError("failed"));
      pending.delete(id);
    }
    handlers.shutdown("host-gone");
  });

  return {
    notify: send,
    supports: (method) => hostMethods.has(method),
    request: (method, params, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) => {
      if (!hostMethods.has(method)) return Promise.reject(new HostRequestError("unknown_method"));
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new HostRequestError("timeout"));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        void send(params === undefined ? { type: "tentacle:request", id, method } : { type: "tentacle:request", id, method, params });
      });
    },
  };
}

let channel: HostChannel | null = null;

/** Ouvre le canal du processus, une fois, en tête du démarrage. `null` sans hôte. */
export function startHostChannel(handlers: HostChannelHandlers, port: HostPort = process): HostChannel | null {
  channel ??= createHostChannel(port, handlers);
  return channel;
}

/** Un message à l'hôte, résolu une fois parti ; sans hôte, rien. */
export function notifyHost(message: ServerToHostMessage): Promise<void> {
  return channel ? channel.notify(message) : Promise.resolve();
}

/** Le serveur est-il supervisé par un hôte qui sait faire `method` ? */
export function hostSupports(method: string): boolean {
  return channel?.supports(method) ?? false;
}

/** Une question à l'hôte ; sans hôte, `unknown_method`. */
export function requestHost(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
  return channel ? channel.request(method, params, timeoutMs) : Promise.reject(new HostRequestError("unknown_method"));
}
