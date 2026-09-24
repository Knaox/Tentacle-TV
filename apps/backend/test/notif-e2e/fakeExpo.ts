/**
 * Le faux service Expo Push du banc : il reçoit exactement ce que le SDK
 * enverrait à exp.host (EXPO_BASE_URL le redirige ici), corps gzip compris,
 * garde chaque message et répond un ticket « ok » par message.
 */

import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { type?: string; refId?: string } & Record<string, unknown>;
  at: number;
}

export class FakeExpo {
  readonly messages: PushMessage[] = [];
  private server: Server | null = null;

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      void readRaw(req).then((raw) => {
        const text = (req.headers["content-encoding"] === "gzip" ? gunzipSync(raw) : raw).toString("utf8");
        const parsed = JSON.parse(text) as Omit<PushMessage, "at"> | Array<Omit<PushMessage, "at">>;
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const m of list) this.messages.push({ ...m, data: m.data ?? {}, at: Date.now() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: list.map((_, i) => ({ status: "ok", id: `ticket-${Date.now()}-${i}` })) }));
      });
    });
    await new Promise<void>((ok) => this.server!.listen(0, "127.0.0.1", ok));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((ok) => this.server?.close(() => ok()) ?? ok());
  }

  /** Les messages reçus par un jeton d'appareil depuis `since`. */
  to(token: string, since = 0): PushMessage[] {
    return this.messages.filter((m) => m.to === token && m.at >= since);
  }

  since(since: number): PushMessage[] {
    return this.messages.filter((m) => m.at >= since);
  }
}

function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", fail);
  });
}
