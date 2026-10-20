/**
 * Une socket `/api/ws` brute, au nom d'un jeton — l'appareil de l'autre membre
 * du banc. Garde ses messages, et attend celui qu'on lui décrit.
 */

type Message = { type: string } & Record<string, unknown>;

export class RawSocket {
  private messages: Message[] = [];
  private waiters: Array<{ match: (m: Message) => boolean; resolve: (m: Message) => void }> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as Message;
      const waiter = this.waiters.find((w) => w.match(msg));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(msg);
      } else {
        this.messages.push(msg);
      }
    };
  }

  /** `connect` : la WebSocket de l'appareil (un téléphone y joint le cookie de son pot). */
  static async open(backendUrl: string, token: string, connect: (url: string) => WebSocket = (url) => new WebSocket(url)): Promise<RawSocket> {
    const ws = connect(`${backendUrl.replace(/^http/, "ws")}/api/ws`);
    const socket = new RawSocket(ws);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
      ws.onerror = () => reject(new Error("socket brute : échec"));
      void socket.next((m) => m.type === "auth_ok").then(() => resolve());
    });
    return socket;
  }

  /** Le prochain message (déjà reçu ou à venir) qui répond à `match`, en 15 s au plus. */
  next(match: (m: Message) => boolean, timeoutMs = 15_000): Promise<Message> {
    const index = this.messages.findIndex(match);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket brute : message attendu jamais reçu")), timeoutMs);
      this.waiters.push({ match, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }

  clear(): void {
    this.messages = [];
  }

  close(): void {
    this.ws.close();
  }
}
