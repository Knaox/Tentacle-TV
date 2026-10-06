import { request } from "node:https";
import { request as httpRequest } from "node:http";

/**
 * Une requête HTTPS vers 127.0.0.1 en présentant un nom (SNI, Host) : le banc
 * ne dépend d'aucun DNS. Le certificat du banc (autorité interne de Caddy,
 * certificat par défaut de Traefik) n'est pas vérifié — on éprouve le routage
 * et les en-têtes, pas une autorité publique.
 */
export interface RawReply {
  status: number;
  /** Les en-têtes bruts, dans l'ordre, doublons compris. */
  raw: string[];
  header(name: string): string[];
}

function headerValues(raw: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < raw.length; i += 2) if (raw[i].toLowerCase() === name.toLowerCase()) values.push(raw[i + 1]);
  return values;
}

function wrap(status: number, raw: string[]): RawReply {
  return { status, raw, header: (name) => headerValues(raw, name) };
}

export function httpsCall(host: string, port: number, path: string, init: { method?: string; headers?: Record<string, string> } = {}): Promise<RawReply> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path, method: init.method ?? "GET", servername: host, rejectUnauthorized: false, headers: { host, ...init.headers } },
      (res) => {
        res.resume();
        res.on("end", () => resolve(wrap(res.statusCode ?? 0, res.rawHeaders)));
      },
    );
    req.setTimeout(15_000, () => req.destroy(new Error("délai dépassé")));
    req.on("error", reject);
    req.end();
  });
}

export function httpCall(host: string, port: number, path: string): Promise<RawReply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
      res.resume();
      res.on("end", () => resolve(wrap(res.statusCode ?? 0, res.rawHeaders)));
    });
    req.setTimeout(15_000, () => req.destroy(new Error("délai dépassé")));
    req.on("error", reject);
    req.end();
  });
}
