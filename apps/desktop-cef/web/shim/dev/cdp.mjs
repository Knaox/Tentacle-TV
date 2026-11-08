// Client CDP minimal (WebSocket natif de Node ≥ 22) — rien à installer.
export const CDP_PORT = Number(process.env.PONT_CDP_PORT ?? 9303);

export async function pageTarget(port = CDP_PORT) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("aucune page dans le Chrome du pont");
  return page;
}

export class Cdp {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (msg) => {
      const data = JSON.parse(String(msg.data));
      if (data.id !== undefined) {
        const p = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) p?.reject(new Error(`${data.error.message} (${data.error.code})`));
        else p?.resolve(data.result);
        return;
      }
      for (const cb of this.handlers.get(data.method) ?? []) cb(data.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, cb) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(cb);
  }

  /** Évalue une expression dans la page ; rend sa valeur (promesses attendues). */
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  close() {
    this.ws.close();
  }
}
