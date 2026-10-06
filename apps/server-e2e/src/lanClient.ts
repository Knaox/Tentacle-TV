import { request as httpRequest } from "node:http";
import { docker } from "./stack";

/**
 * Un appareil « du réseau local », simulé par un conteneur posé sur le réseau
 * de la pile : il joint Tentacle DIRECTEMENT, depuis sa propre adresse privée.
 * Depuis le Mac, colima (comme Docker Desktop) fait passer chaque connexion par
 * la passerelle de la pile : l'adresse réelle s'y perd, et le code est demandé.
 *
 * Avec `forwardedFor`, le même conteneur joue un mandataire voisin de confiance
 * (Caddy, NPM…) qui transmet l'adresse de son client.
 */
export interface LanRequest {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  /** L'hôte tapé dans le navigateur (`Host`). */
  host: string;
  session?: string;
  forwardedFor?: string;
}

export interface LanReply {
  status: number;
  body: unknown;
}

// `fetch` ne laisse pas poser `Host` : `http.request`, si.
const SCRIPT = `
const r = JSON.parse(process.env.REQ);
const payload = r.body === undefined ? undefined : JSON.stringify(r.body);
const headers = { host: r.host };
if (payload) headers["content-type"] = "application/json";
if (r.session) headers["x-tentacle-setup"] = r.session;
if (r.forwardedFor) headers["x-forwarded-for"] = r.forwardedFor;
const req = require("http").request({ host: "tentacle", port: 3000, path: "/api/setup" + r.path, method: r.method || "GET", headers }, (res) => {
  let text = ""; res.on("data", (c) => (text += c));
  res.on("end", () => { let body = text; try { body = JSON.parse(text); } catch {} console.log(JSON.stringify({ status: res.statusCode, body })); });
});
req.on("error", (e) => console.log(JSON.stringify({ status: 0, body: String(e) })));
if (payload) req.write(payload);
req.end();
`;

/** Un conteneur qui dure : la même adresse d'un appel à l'autre, comme un vrai appareil. */
export class LanDevice {
  constructor(
    readonly name: string,
    readonly network: string,
  ) {}

  async start(): Promise<void> {
    await docker("rm", "-f", this.name).catch(() => undefined);
    await docker("run", "-d", "--name", this.name, "--network", this.network, "node:24-alpine", "sleep", "3600");
  }

  async address(): Promise<string> {
    return (await docker("inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", this.name)).trim();
  }

  async call(request: LanRequest): Promise<LanReply> {
    const out = await docker("exec", "-e", `REQ=${JSON.stringify(request)}`, this.name, "node", "-e", SCRIPT);
    return JSON.parse(out.trim().split("\n").pop() ?? "{}") as LanReply;
  }

  async remove(): Promise<void> {
    await docker("rm", "-f", this.name).catch(() => undefined);
  }
}

/**
 * Le même appel, depuis le Mac (par la redirection de ports de colima : la
 * passerelle de la pile), avec l'hôte qu'un navigateur aurait tapé. `fetch`
 * ne laisse pas poser `Host` : `http.request`, si.
 */
export function hostCall(port: number, req: LanRequest): Promise<LanReply> {
  return new Promise((resolve, reject) => {
    const payload = req.body === undefined ? undefined : JSON.stringify(req.body);
    const headers: Record<string, string> = { host: req.host };
    if (payload) headers["content-type"] = "application/json";
    if (req.session) headers["x-tentacle-setup"] = req.session;
    if (req.forwardedFor) headers["x-forwarded-for"] = req.forwardedFor;
    const call = httpRequest({ host: "127.0.0.1", port, path: `/api/setup${req.path}`, method: req.method ?? "GET", headers, timeout: 60_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          /* corps non JSON */
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    call.on("error", reject);
    call.on("timeout", () => call.destroy(new Error("délai dépassé")));
    if (payload) call.write(payload);
    call.end();
  });
}
