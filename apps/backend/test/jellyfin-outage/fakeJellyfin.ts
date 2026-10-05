/**
 * Le faux Jellyfin du banc des pannes : il rejoue, à la milliseconde près,
 * ce que Jellyfin 10.11.11 a fait sous nos yeux le 2026-10-05 (conteneur
 * officiel, scénarios « POST /System/Restart », « docker restart »,
 * « docker stop / start », « docker kill ») :
 *
 *  - l'annonce sur TOUTES les sockets (`ServerRestarting` par l'API,
 *    `ServerShuttingDown` sur SIGTERM, rien sur un kill), puis la fermeture
 *    1000 « System Shutdown » (1006 sur un kill) ;
 *  - le port FERMÉ (ECONNREFUSED) le temps que le processus reparte ;
 *  - au démarrage, UN 200 du serveur d'attente (camelCase, sans `Id`), des
 *    connexions coupées, puis 503 « Jellyfin Server is loading » ;
 *  - au retour, il a TOUT oublié : sessions, lectures, transcodages.
 *
 * Il note chaque requête (horodatée) : c'est la preuve de ce que le backend
 * a fait, et quand.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

export const API_KEY = "panne-api-key";
const SERVER_ID = "f00dfacef00dfacef00dfacef00dface";
const LOADING = "Jellyfin Server is loading. Please try again shortly.";

export interface FakeUser {
  Id: string;
  Name: string;
  token: string;
}

export interface Hit {
  at: number;
  method: string;
  path: string;
  token: string | null;
  body: Record<string, unknown> | null;
}

type Phase = "up" | "closed" | "transient" | "loading";

/** Le jeton d'une requête, sous toutes les formes que Jellyfin accepte. */
function tokenOf(req: IncomingMessage, url: URL): string | null {
  const auth = String(req.headers.authorization ?? req.headers["x-emby-authorization"] ?? "");
  const match = /Token="([^"]+)"/.exec(auth);
  return match?.[1] ?? (req.headers["x-emby-token"] as string | undefined) ?? url.searchParams.get("ApiKey") ?? url.searchParams.get("api_key");
}

export class FakeJellyfin {
  readonly hits: Hit[] = [];
  readonly socketsOpened: Array<{ at: number; token: string | null }> = [];
  private phase: Phase = "closed";
  private server: Server | null = null;
  private readonly connections = new Set<Socket>();
  private readonly sockets = new Map<WebSocket, string | null>();
  private readonly wss = new WebSocketServer({ noServer: true });

  constructor(readonly port: number, private readonly users: FakeUser[]) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /** Le port s'ouvre et Jellyfin sert aussitôt (démarrage du banc). */
  async start(): Promise<void> {
    await this.listen();
    this.phase = "up";
  }

  /** Requêtes reçues depuis `since`, filtrées par chemin. */
  hitsSince(since: number, path?: string, token?: string): Hit[] {
    return this.hits.filter((h) => h.at >= since && (path === undefined || h.path === path) && (token === undefined || h.token === token));
  }

  // ── Les pannes, telles que mesurées ──

  /** `POST /System/Restart` : ServerRestarting, ~0,7 s de port fermé, `loadingMs` de 503. */
  async apiRestart(loadingMs = 6_600): Promise<void> {
    this.announce("ServerRestarting");
    await this.closePort();
    await sleep(700);
    await this.boot(loadingMs, false);
  }

  /** `docker restart` : ServerShuttingDown, ~1,3 s fermé, le 200 transitoire, puis `loadingMs` de 503. */
  async dockerRestart(loadingMs = 5_000): Promise<void> {
    this.announce("ServerShuttingDown");
    await this.closePort();
    await sleep(1_300);
    await this.boot(loadingMs, true);
  }

  /** `docker stop` : ServerShuttingDown, puis port fermé jusqu'à `dockerStart`. */
  async dockerStop(): Promise<void> {
    this.announce("ServerShuttingDown");
    await this.closePort();
  }

  /** `docker kill` : rien d'annoncé, sockets coupées net (1006), port fermé. */
  async dockerKill(): Promise<void> {
    for (const ws of this.sockets.keys()) ws.terminate();
    await this.closePort();
  }

  /** `docker start` (après stop ou kill) : le 200 transitoire, puis `loadingMs` de 503. */
  async dockerStart(loadingMs = 5_700): Promise<void> {
    await this.boot(loadingMs, true);
  }

  /** Les sockets tombent, Jellyfin continue de servir (NAT vidée, proxy relancé…). */
  socketBlip(): void {
    for (const ws of this.sockets.keys()) ws.terminate();
  }

  async stop(): Promise<void> {
    for (const ws of this.sockets.keys()) ws.terminate();
    await this.closePort();
  }

  /** Heure à laquelle Jellyfin est redevenu VRAIMENT disponible (dernière bascule en « up »). */
  upSince = 0;

  // ── Mécanique ──

  private announce(type: "ServerRestarting" | "ServerShuttingDown"): void {
    for (const ws of this.sockets.keys()) ws.send(JSON.stringify({ MessageType: type, Data: "" }));
    // Mesuré : la fermeture suit l'annonce de moins de 10 ms.
    for (const ws of this.sockets.keys()) ws.close(1000, "System Shutdown");
  }

  /** Démarrage : (200 transitoire du serveur d'attente, coupure), 503, puis le vrai serveur — amnésique. */
  private async boot(loadingMs: number, transient: boolean): Promise<void> {
    await this.listen();
    if (transient) {
      this.phase = "transient";
      await sleep(1_000);
      this.phase = "closed";
      this.dropConnections();
      await sleep(250);
    }
    this.phase = "loading";
    await sleep(loadingMs);
    this.phase = "up";
    this.upSince = Date.now();
  }

  private listen(): Promise<void> {
    if (this.server) return Promise.resolve();
    const server = createServer((req, res) => this.handle(req, res));
    server.on("connection", (socket) => {
      this.connections.add(socket);
      socket.on("close", () => this.connections.delete(socket));
    });
    server.on("upgrade", (req, socket, head) => {
      if (this.phase !== "up") {
        socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
        return;
      }
      const url = new URL(req.url ?? "/", this.url);
      const token = tokenOf(req, url);
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onSocket(ws, token));
    });
    this.server = server;
    return new Promise((ok) => server.listen(this.port, "127.0.0.1", () => ok()));
  }

  private closePort(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.phase = "closed";
    if (!server) return Promise.resolve();
    const closed = new Promise<void>((ok) => server.close(() => ok()));
    this.dropConnections();
    return closed;
  }

  private dropConnections(): void {
    for (const socket of this.connections) socket.destroy();
    this.connections.clear();
  }

  private onSocket(ws: WebSocket, token: string | null): void {
    this.sockets.set(ws, token);
    this.socketsOpened.push({ at: Date.now(), token });
    ws.send(JSON.stringify({ MessageType: "ForceKeepAlive", Data: 60 }));
    ws.on("message", (raw) => {
      const msg = safeJson(String(raw)) as { MessageType?: string } | null;
      if (msg?.MessageType === "KeepAlive") ws.send(JSON.stringify({ MessageType: "KeepAlive" }));
      if (msg?.MessageType === "SessionsStart") ws.send(JSON.stringify({ MessageType: "Sessions", Data: [] }));
    });
    ws.on("close", () => this.sockets.delete(ws));
  }

  /** Toutes les sondes reçues, quelle que soit la phase : la charge que la surveillance impose. */
  readonly probes: Array<{ at: number; phase: Phase }> = [];

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", this.url);
    if (url.pathname === "/System/Info/Public") this.probes.push({ at: Date.now(), phase: this.phase });
    if (this.phase === "transient" && url.pathname === "/System/Info/Public") {
      // Le serveur d'attente de 10.11 : camelCase, sans Id.
      return json(res, 200, { localAddress: this.url, serverName: "banc", version: "10.11.11" });
    }
    if (this.phase !== "up") {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end(LOADING);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const token = tokenOf(req, url);
      this.hits.push({ at: Date.now(), method: req.method ?? "GET", path: url.pathname, token, body: safeJson(raw) as Record<string, unknown> | null });
      this.route(req.method ?? "GET", url, token, res);
    });
  }

  private route(method: string, url: URL, token: string | null, res: ServerResponse): void {
    const info = {
      LocalAddress: this.url, ServerName: "banc", Version: "10.11.11", ProductName: "Jellyfin Server",
      OperatingSystem: "", Id: SERVER_ID, StartupWizardCompleted: true,
    };
    const user = this.users.find((u) => u.token === token);
    switch (url.pathname) {
      case "/System/Info/Public": return json(res, 200, info);
      case "/System/Info": return token === API_KEY ? json(res, 200, info) : json(res, 401, {});
      case "/Users/Me":
        return user ? json(res, 200, { Id: user.Id, Name: user.Name, Policy: { IsAdministrator: false } }) : json(res, 401, {});
      case "/Users": return json(res, 200, this.users.map((u) => ({ Id: u.Id, Name: u.Name, Policy: {} })));
      case "/Sessions": return json(res, 200, []);
    }
    if (method === "POST") {
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, 200, { Items: [], TotalRecordCount: 0 });
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function safeJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));
