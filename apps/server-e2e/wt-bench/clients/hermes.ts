/**
 * Un client CDP minimal vers Hermes, par l'inspecteur de Metro
 * (`/json/list` → `webSocketDebuggerUrl`). Sert à LIRE l'app mobile au
 * simulateur sans geste : position du lecteur, route, état de la salle.
 *
 * Pièges connus (mémoire du projet) : `Runtime.evaluate` de Hermes refuse les
 * fonctions `async` et `awaitPromise` n'y marche pas — une promesse se résout
 * dans un global, relu ensuite.
 */

interface Target {
  id: string;
  title: string;
  description?: string;
  deviceName?: string;
  webSocketDebuggerUrl: string;
}

export async function listTargets(metroPort: number): Promise<Target[]> {
  const res = await fetch(`http://127.0.0.1:${metroPort}/json/list`);
  return (await res.json()) as Target[];
}

export class HermesSession {
  private nextId = 1;
  private readonly pending = new Map<number, (v: unknown) => void>();

  /** Les journaux de la console de l'app (`[WT …]` et erreurs), horodatés à la réception. */
  readonly console: string[] = [];

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as {
        id?: number; result?: unknown; error?: unknown; method?: string;
        params?: { type?: string; args?: Array<{ value?: unknown; description?: string }> };
      };
      if (msg.method === "Runtime.consoleAPICalled") {
        const text = (msg.params?.args ?? []).map((a) => (a.value !== undefined ? (typeof a.value === "string" ? a.value : JSON.stringify(a.value)) : a.description ?? "")).join(" ");
        if (/\[WT|wt-|error/i.test(text)) this.console.push(`${Date.now()} ${msg.params?.type ?? "log"} ${text.slice(0, 400)}`);
        return;
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg.error ? { error: msg.error } : msg.result);
        this.pending.delete(msg.id);
      }
    });
  }

  /** Se branche sur la cible dont l'appareil porte ce nom (un Metro, plusieurs simulateurs). */
  static async connect(metroPort: number, deviceName: string): Promise<HermesSession> {
    const targets = await listTargets(metroPort);
    // Deux cibles par appareil : le JS de l'app (« React Native Bridgeless ») et le
    // moteur de Reanimated — seule la première porte l'app.
    const js = targets.filter((t) => !(t.description ?? "").includes("Reanimated"));
    const target = js.find((t) => (t.deviceName ?? t.title).includes(deviceName)) ?? (js.length === 1 ? js[0] : undefined);
    if (!target) throw new Error(`aucune cible Hermes pour « ${deviceName} » (${targets.map((t) => t.deviceName ?? t.title).join(", ")})`);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((ok, ko) => {
      ws.addEventListener("open", () => ok());
      ws.addEventListener("error", () => ko(new Error("socket CDP refusée")));
    });
    const session = new HermesSession(ws);
    await session.send("Runtime.enable");
    return session;
  }

  /** Fermée (app relancée, Metro rechargé) : l'appelant se reconnecte. */
  get closed(): boolean {
    return this.ws.readyState !== WebSocket.OPEN;
  }

  /**
   * Une commande CDP, avec un délai : une app rechargée ou un Mac saturé ne
   * répond plus, et une promesse sans fin gelait tout le scénario (vu le 20/10,
   * 30 min bloqué sur une lecture de position).
   */
  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 8_000): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((ok, ko) => {
      if (this.closed) {
        ko(new Error("socket CDP fermée"));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        ko(new Error(`CDP ${method} sans réponse en ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, (v) => {
        clearTimeout(timer);
        ok(v);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Évalue une expression et rend sa valeur (sérialisée en JSON par Hermes). */
  async eval<T = unknown>(expression: string): Promise<T> {
    const res = (await this.send("Runtime.evaluate", { expression: `JSON.stringify((function(){ ${expression} })())`, returnByValue: true })) as {
      result?: { value?: string };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
      error?: unknown;
    };
    if (res.exceptionDetails) throw new Error(`Hermes : ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`);
    if (res.error) throw new Error(`CDP : ${JSON.stringify(res.error)}`);
    const raw = res.result?.value;
    return (raw === undefined ? undefined : JSON.parse(raw)) as T;
  }

  close(): void {
    this.ws.close();
  }
}
