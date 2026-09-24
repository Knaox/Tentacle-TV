/**
 * Le faux Jellyfin du banc de bout en bout des notifications : des comptes
 * (jeton → utilisateur, pour `/Users/Me`), une bibliothèque qu'on modifie en
 * direct, et le WebSocket qui annonce `LibraryChanged` comme le vrai. Ce que
 * le backend demande d'autre au démarrage reçoit une réponse vide et est
 * compté dans `unknown` (diagnostic).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

export interface FakeUser {
  Id: string;
  Name: string;
  token: string;
  admin?: boolean;
}

export interface FakeItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode";
  SeriesId?: string;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ProductionYear?: number;
  ProviderIds?: { Tmdb?: string };
}

export const ADMIN_API_KEY = "bench-admin-key";

export class FakeJellyfin {
  readonly items = new Map<string, FakeItem>();
  readonly unknown = new Map<string, number>();
  private readonly sockets = new Set<WebSocket>();
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(readonly users: FakeUser[]) {}

  async start(): Promise<string> {
    this.server = createServer((req, res) => this.handle(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: "/socket" });
    this.wss.on("connection", (ws) => {
      this.sockets.add(ws);
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as { MessageType?: string };
          if (msg.MessageType === "KeepAlive") ws.send(JSON.stringify({ MessageType: "KeepAlive" }));
        } catch {
          /* trame illisible : ignorée */
        }
      });
      ws.on("close", () => this.sockets.delete(ws));
    });
    await new Promise<void>((ok) => this.server!.listen(0, "127.0.0.1", ok));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    for (const ws of this.sockets) ws.terminate();
    this.wss?.close();
    await new Promise<void>((ok) => this.server?.close(() => ok()) ?? ok());
  }

  get wsClients(): number {
    return this.sockets.size;
  }

  /** Ajoute des items et prévient les sockets, comme Jellyfin après un scan. */
  addItems(items: FakeItem[]): void {
    for (const it of items) this.items.set(it.Id, it);
    this.broadcast({ ItemsAdded: items.map((i) => i.Id), ItemsRemoved: [] });
  }

  removeItems(ids: string[]): void {
    for (const id of ids) this.items.delete(id);
    this.broadcast({ ItemsAdded: [], ItemsRemoved: ids });
  }

  private broadcast(data: { ItemsAdded: string[]; ItemsRemoved: string[] }): void {
    const frame = JSON.stringify({
      MessageType: "LibraryChanged",
      Data: { ...data, ItemsUpdated: [], FoldersAddedTo: [], FoldersRemovedFrom: [], CollectionFolders: [] },
    });
    for (const ws of this.sockets) ws.send(frame);
  }

  private userFor(req: IncomingMessage, url: URL): FakeUser | null {
    const token =
      (req.headers["x-emby-token"] as string | undefined) ??
      url.searchParams.get("api_key") ??
      /Token="([^"]+)"/.exec(String(req.headers["authorization"] ?? ""))?.[1];
    if (!token) return null;
    if (token === ADMIN_API_KEY) return this.users.find((u) => u.admin) ?? null;
    return this.users.find((u) => u.token === token) ?? null;
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://fake");
    const path = url.pathname.replace(/\/+$/, "");
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    const user = this.userFor(req, url);

    if (path === "/Users/Me") return user ? send(200, this.userDto(user)) : send(401, { message: "Unauthorized" });
    if (!user) return send(401, { message: "Unauthorized" });
    if (req.method !== "GET") return send(204, undefined);

    if (path === "/Users") return send(200, this.users.map((u) => this.userDto(u)));
    const userMatch = /^\/Users\/([^/]+)$/.exec(path);
    if (userMatch) {
      const u = this.users.find((x) => x.Id === userMatch[1]);
      return u ? send(200, this.userDto(u)) : send(404, { message: "Not found" });
    }
    if (path === "/System/Info" || path === "/System/Info/Public") {
      return send(200, { Id: "fake-server", ServerName: "Banc", Version: "10.11.0", ProductName: "Jellyfin Server" });
    }
    if (path === "/Items/Counts") {
      const count = (t: string) => [...this.items.values()].filter((i) => i.Type === t).length;
      return send(200, { MovieCount: count("Movie"), SeriesCount: count("Series"), EpisodeCount: count("Episode") });
    }
    if (path === "/Items" || /^\/Users\/[^/]+\/Items$/.test(path)) return send(200, this.queryItems(url));
    const seasons = /^\/Shows\/([^/]+)\/Seasons$/.exec(path);
    if (seasons) {
      const numbers = new Set(
        [...this.items.values()]
          .filter((i) => i.Type === "Episode" && i.SeriesId === seasons[1] && i.ParentIndexNumber != null)
          .map((i) => i.ParentIndexNumber as number),
      );
      const items = [...numbers].sort((a, b) => a - b).map((n) => ({ Id: `${seasons[1]}-s${n}`, Type: "Season", IndexNumber: n }));
      return send(200, { Items: items, TotalRecordCount: items.length });
    }
    if (path === "/Sessions" || path === "/Library/VirtualFolders") return send(200, []);

    this.unknown.set(path, (this.unknown.get(path) ?? 0) + 1);
    return send(200, { Items: [], TotalRecordCount: 0 });
  }

  private userDto(u: FakeUser): Record<string, unknown> {
    return { Id: u.Id, Name: u.Name, Policy: { IsAdministrator: !!u.admin, EnableAllFolders: true } };
  }

  private queryItems(url: URL): { Items: FakeItem[]; TotalRecordCount: number; StartIndex: number } {
    let list = [...this.items.values()];
    const ids = url.searchParams.get("Ids") ?? url.searchParams.get("ids");
    if (ids) {
      const wanted = new Set(ids.split(","));
      list = list.filter((i) => wanted.has(i.Id));
    }
    const types = url.searchParams.get("IncludeItemTypes") ?? url.searchParams.get("includeItemTypes");
    if (types) {
      const wanted = new Set(types.split(","));
      list = list.filter((i) => wanted.has(i.Type));
    }
    const provider = url.searchParams.get("AnyProviderIdEquals");
    if (provider?.startsWith("tmdb.")) {
      const tmdb = provider.slice("tmdb.".length);
      list = list.filter((i) => i.ProviderIds?.Tmdb === tmdb);
    }
    const start = Number(url.searchParams.get("StartIndex") ?? 0);
    const limit = Number(url.searchParams.get("Limit") ?? list.length);
    return { Items: list.slice(start, start + limit), TotalRecordCount: list.length, StartIndex: start };
  }
}
