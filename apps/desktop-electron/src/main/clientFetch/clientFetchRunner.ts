/**
 * L'EXÉCUTION d'une requête déléguée, dans le processus principal : depuis la
 * connexion de l'utilisateur, SANS cookie, sans cache, sans aucun identifiant
 * du navigateur ni de Tentacle (ce n'est pas la session de la page). La
 * requête a déjà été jugée par l'hôte ; elle l'est ICI une seconde fois, contre
 * le manifeste que le principal a lu lui-même (`pluginManifests.ts`).
 *
 * - Redirections suivies À LA MAIN (3 au plus), chacune revalidée ;
 * - adresses privées refusées dans la résolution même (`safeLookup.ts`) ;
 * - corps lu jusqu'à `maxBytes` (décompressé), délai unique sur tout le trajet.
 */

import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import { allowedUrl, checkClientFetchRequest, CLIENT_FETCH_LIMITS, type ClientFetchManifest, type ClientFetchOutcome, type ClientFetchRequest, type ClientFetchRefusal } from "./pluginClientFetch";
import { publicOnlyLookup } from "./safeLookup";

export interface HopRequest {
  url: URL;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string | undefined;
  deadline: number;
  maxBytes: number;
}

export type HopResult =
  | { kind: "response"; status: number; contentType: string | null; body: string }
  | { kind: "redirect"; status: number; location: string }
  | { kind: "failed"; reason: ClientFetchRefusal };

export type Hop = (request: HopRequest) => Promise<HopResult>;

class Refusal extends Error {
  constructor(readonly reason: ClientFetchRefusal) {
    super(reason);
  }
}

function decoded(res: IncomingMessage): Readable {
  const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip") return res.pipe(createGunzip());
  if (encoding === "br") return res.pipe(createBrotliDecompress());
  if (encoding === "deflate") return res.pipe(createInflate());
  return res;
}

async function readCapped(stream: Readable, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > maxBytes) {
      stream.destroy();
      throw new Refusal("tooLarge");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Un saut HTTPS réel : pas de cookie, pas de cache, la résolution qui refuse le privé. */
export const httpsHop: Hop = (hop) =>
  new Promise<HopResult>((resolve) => {
    const remaining = hop.deadline - Date.now();
    if (remaining <= 0) return resolve({ kind: "failed", reason: "timeout" });
    const req = httpsRequest(
      hop.url,
      {
        method: hop.method,
        headers: { ...hop.headers, "accept-encoding": "gzip, deflate, br" },
        lookup: publicOnlyLookup,
        timeout: remaining,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status) && typeof res.headers.location === "string") {
          res.resume();
          return resolve({ kind: "redirect", status, location: res.headers.location });
        }
        const contentType = typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;
        readCapped(decoded(res), hop.maxBytes).then(
          (body) => resolve({ kind: "response", status, contentType, body }),
          (err: unknown) => resolve({ kind: "failed", reason: err instanceof Refusal ? err.reason : "network" }),
        );
      },
    );
    const timer = setTimeout(() => req.destroy(new Refusal("timeout")), remaining);
    req.once("close", () => clearTimeout(timer));
    req.once("timeout", () => req.destroy(new Refusal("timeout")));
    req.once("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ kind: "failed", reason: err instanceof Refusal ? err.reason : err.code === "EPRIVATE" ? "refused" : "network" });
    });
    if (hop.body !== undefined) req.end(hop.body);
    else req.end();
  });

/** La requête, jugée contre `manifest`, puis exécutée (redirections comprises). */
export async function runClientFetch(request: ClientFetchRequest, manifest: ClientFetchManifest, hop: Hop = httpsHop, now: () => number = Date.now): Promise<ClientFetchOutcome> {
  if (checkClientFetchRequest(request, manifest) !== null) return { ok: false, reason: "refused" };
  const deadline = now() + (request.timeoutMs ?? CLIENT_FETCH_LIMITS.defaultTimeoutMs);
  const maxBytes = request.maxBytes ?? CLIENT_FETCH_LIMITS.defaultMaxBytes;
  let url = new URL(request.url);
  let method = request.method;
  let body = request.body;
  for (let hops = 0; hops <= CLIENT_FETCH_LIMITS.maxRedirects; hops++) {
    const result = await hop({ url, method, headers: request.headers ?? {}, body, deadline, maxBytes });
    if (result.kind === "failed") return { ok: false, reason: result.reason };
    if (result.kind === "response") {
      return { ok: true, response: { status: result.status, url: url.href, headers: result.contentType ? { "content-type": result.contentType } : {}, body: result.body } };
    }
    let next: URL | null;
    try {
      next = allowedUrl(new URL(result.location, url).href, manifest.hosts);
    } catch {
      next = null;
    }
    if (!next) return { ok: false, reason: "refused" };
    // 303, et 301/302 après un POST : le navigateur repart en GET sans corps.
    if (result.status === 303 || ((result.status === 301 || result.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
    }
    url = next;
  }
  return { ok: false, reason: "refused" };
}
