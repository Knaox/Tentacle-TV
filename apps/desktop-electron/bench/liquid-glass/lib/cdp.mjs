// Client CDP minimal du banc : une connexion par cible, `send` qui attend sa
// réponse, `evaluate` qui enveloppe le code dans une IIFE asynchrone (le
// `Runtime.evaluate` est un REPL : un `const` redéclaré d'un pas à l'autre
// lèverait « Uncaught »).
import WebSocket from "ws";

export async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return response.json();
}

/** Attend une cible dont l'URL vérifie `match`, au plus `timeoutMs`. */
export async function waitForTarget(port, match, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const target = (await listTargets(port)).find((t) => t.type === "page" && match(t.url));
      if (target) return target;
    } catch {
      // Le port n'écoute pas encore : Electron démarre.
    }
    if (Date.now() > end) throw new Error(`aucune cible CDP sur ${port} après ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export class Cdp {
  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(`${message.error.message} (${waiter.method})`));
        else waiter.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  /** Évalue `body` (corps de fonction asynchrone, qui `return` sa valeur). */
  async evaluate(body) {
    const result = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`évaluation refusée : ${text}`);
    }
    return result.result.value;
  }

  /** Attend que `predicate` (une expression) soit vraie dans la page. */
  async waitFor(predicate, timeoutMs = 20_000, label = predicate) {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const ok = await this.evaluate(`try { return !!(${predicate}); } catch { return false; }`).catch(() => false);
      if (ok) return;
      if (Date.now() > end) throw new Error(`attente dépassée : ${label}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  close() {
    this.socket.close();
  }
}
