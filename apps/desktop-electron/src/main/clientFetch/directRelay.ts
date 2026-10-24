/**
 * Le RELAIS LOCAL des flux directs (`PlaybackSource.direct`) : mpv lit
 * `http://127.0.0.1:<port>/d/<jeton>`, le principal tire le flux de son hôte
 * depuis la connexion de l'utilisateur. Deux raisons de ne pas donner l'adresse
 * directe à mpv :
 * - mpv pose les en-têtes d'authentification du serveur sur TOUTES ses requêtes
 *   (`http-header-fields`) : le jeton partirait chez l'hôte du flux ;
 * - le REPLI : tant qu'aucun octet du direct n'a été servi, un refus de l'hôte
 *   (URL expirée, liée à une autre adresse, coupure) bascule sur le flux du
 *   serveur (`url` de la source), sans que mpv le sache. Après, une erreur rend
 *   502 : le moteur redemande la source (`needSource`), comme pour toute source
 *   d'extension.
 *
 * Seulement la boucle locale, des jetons de 32 octets aléatoires, des entrées
 * oubliées après une heure sans lecture.
 */

import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest, type ClientRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { publicOnlyLookup } from "./safeLookup";

interface Entry {
  directUrl: string;
  fallbackUrl: string;
  fallbackHeaders: Record<string, string>;
  /** Un octet du direct a été servi : plus de repli possible (les deux flux peuvent différer). */
  delivered: boolean;
  mode: "direct" | "server";
  /** L'échec du direct a été signalé au serveur (`direct=failed` sur la première requête de repli). */
  reported: boolean;
  usedAt: number;
}

/**
 * Le signal d'échec du flux direct (contrat `PlaybackSource.direct`) : la première requête de repli vers `url`
 * porte `direct=failed`, l'extension y oublie la source de l'appareil (et la correspondance qu'il a fournie).
 */
export function withDirectFailed(url: string): string {
  const u = new URL(url);
  u.searchParams.set("direct", "failed");
  return u.href;
}

const IDLE_MS = 3_600_000;
const PASSED_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];
const CONNECT_TIMEOUT_MS = 8_000;

export interface RelayStats {
  direct: number;
  fallbacks: number;
}

/** Ouvre la requête vers l'hôte du flux direct (https, adresses publiques seulement ; remplacée dans les tests). */
export type OpenDirect = (url: string, method: string, headers: Record<string, string>, onResponse: (res: IncomingMessage) => void) => ClientRequest;

const openHttps: OpenDirect = (url, method, headers, onResponse) =>
  httpsRequest(url, { method, headers, lookup: publicOnlyLookup, timeout: CONNECT_TIMEOUT_MS }, onResponse);

export class DirectRelay {
  constructor(private readonly openDirect: OpenDirect = openHttps) {}

  private server: Server | null = null;
  private port: Promise<number> | null = null;
  private readonly entries = new Map<string, Entry>();
  readonly stats: RelayStats = { direct: 0, fallbacks: 0 };

  /** L'adresse LOCALE à donner à mpv pour ce flux direct (repli : `fallbackUrl`, avec ses en-têtes). */
  async adopt(directUrl: string, fallbackUrl: string, fallbackHeaders: Record<string, string>): Promise<string> {
    const port = await this.listen();
    this.sweep();
    const id = randomBytes(32).toString("base64url");
    this.entries.set(id, { directUrl, fallbackUrl, fallbackHeaders, delivered: false, mode: "direct", reported: false, usedAt: Date.now() });
    return `http://127.0.0.1:${port}/d/${id}`;
  }

  /** L'origine du relais, une fois démarré (le moteur l'accepte comme source). */
  async origin(): Promise<string> {
    return `http://127.0.0.1:${await this.listen()}`;
  }

  close(): void {
    this.server?.close();
    this.server = null;
    this.port = null;
    this.entries.clear();
  }

  private listen(): Promise<number> {
    this.port ??= new Promise<number>((resolve, reject) => {
      const server = createServer((req, res) => this.serve(req, res));
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("relais local sans port"));
      });
      server.unref();
      this.server = server;
    });
    return this.port;
  }

  private sweep(): void {
    const t = Date.now();
    for (const [id, e] of this.entries) if (t - e.usedAt > IDLE_MS) this.entries.delete(id);
  }

  private serve(req: IncomingMessage, res: ServerResponse): void {
    const id = /^\/d\/([A-Za-z0-9_-]{43})$/.exec(req.url ?? "")?.[1];
    const entry = id ? this.entries.get(id) : undefined;
    if (!entry || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404).end();
      return;
    }
    entry.usedAt = Date.now();
    const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
    const method = req.method;
    if (entry.mode === "server") return this.pipeFrom(entry, "server", method, range, res);
    const upstream = this.openDirect(entry.directUrl, method ?? "GET", range ? { range } : {}, (up) => {
      const status = up.statusCode ?? 502;
      if (status >= 400) {
        up.resume();
        return this.failed(entry, method, range, res);
      }
      this.stats.direct++;
      entry.delivered = true;
      this.answer(up, res);
    });
    upstream.once("timeout", () => upstream.destroy(new Error("délai")));
    upstream.once("error", () => {
      if (!res.headersSent) this.failed(entry, method, range, res);
      else res.destroy();
    });
    res.once("close", () => upstream.destroy());
    upstream.end();
  }

  /** Le direct a refusé : repli sur le serveur s'il n'a encore rien servi, sinon 502 (le moteur redemande la source). */
  private failed(entry: Entry, method: string | undefined, range: string | undefined, res: ServerResponse): void {
    if (entry.delivered) {
      res.writeHead(502).end();
      return;
    }
    entry.mode = "server";
    this.stats.fallbacks++;
    console.warn("[client-fetch] flux direct refusé : repli sur le serveur");
    this.pipeFrom(entry, "server", method, range, res);
  }

  private pipeFrom(entry: Entry, _from: "server", method: string | undefined, range: string | undefined, res: ServerResponse): void {
    const target = new URL(entry.reported ? entry.fallbackUrl : withDirectFailed(entry.fallbackUrl));
    entry.reported = true;
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = send(target, { method, headers: { ...entry.fallbackHeaders, ...(range ? { range } : {}) }, timeout: CONNECT_TIMEOUT_MS }, (up) => this.answer(up, res));
    upstream.once("timeout", () => upstream.destroy(new Error("délai")));
    upstream.once("error", () => (res.headersSent ? res.destroy() : res.writeHead(502).end()));
    res.once("close", () => upstream.destroy());
    upstream.end();
  }

  private answer(up: IncomingMessage, res: ServerResponse): void {
    const headers: Record<string, string> = {};
    for (const name of PASSED_HEADERS) {
      const value = up.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    res.writeHead(up.statusCode ?? 502, headers);
    up.pipe(res);
  }
}
