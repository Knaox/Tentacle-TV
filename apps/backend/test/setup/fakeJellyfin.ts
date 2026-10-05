import { createServer, type IncomingHttpHeaders } from "http";
import type { AddressInfo } from "net";

/**
 * Un faux Jellyfin pour les tests de l'assistant : une table de réponses par
 * « MÉTHODE /chemin », et le relevé de chaque requête reçue (corps compris)
 * pour vérifier ce que l'assistant a envoyé — et ce qu'il n'a PAS envoyé.
 */
export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingHttpHeaders;
  body: unknown;
}

export interface FakeReply {
  status: number;
  json?: unknown;
  /** Un corps brut à la place du JSON. */
  raw?: string;
  headers?: Record<string, string>;
  /** Ne jamais répondre (délai dépassé côté client). */
  hang?: boolean;
}

export type FakeRoute = FakeReply | ((request: RecordedRequest) => FakeReply);

export interface FakeJellyfin {
  url: string;
  requests: RecordedRequest[];
  on(route: string, reply: FakeRoute): void;
  /** Les requêtes reçues sur « MÉTHODE /chemin ». */
  calls(route: string): RecordedRequest[];
  close(): Promise<void>;
}

export async function startFakeJellyfin(): Promise<FakeJellyfin> {
  const routes = new Map<string, FakeRoute>();
  const requests: RecordedRequest[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://fake");
      const text = Buffer.concat(chunks).toString("utf-8");
      let body: unknown = text || undefined;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        /* corps non JSON : gardé en texte */
      }
      const recorded: RecordedRequest = { method: req.method ?? "GET", path: url.pathname, query: url.searchParams, headers: req.headers, body };
      requests.push(recorded);
      const route = routes.get(`${recorded.method} ${recorded.path}`);
      const reply = typeof route === "function" ? route(recorded) : route ?? { status: 404 };
      if (reply.hang) return;
      const payload = reply.raw ?? (reply.json === undefined ? "" : JSON.stringify(reply.json));
      const headers: Record<string, string> = { ...(reply.json !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}), ...reply.headers };
      res.writeHead(reply.status, headers);
      res.end(payload);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    on: (route, reply) => void routes.set(route, reply),
    calls: (route) => requests.filter((r) => `${r.method} ${r.path}` === route),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Le `/System/Info/Public` d'un Jellyfin, vierge ou non. */
export function publicInfo(overrides: Record<string, unknown> = {}): FakeReply {
  return {
    status: 200,
    json: {
      LocalAddress: "http://172.18.0.3:8096",
      ServerName: "jellyfin",
      Version: "10.11.11",
      ProductName: "Jellyfin Server",
      OperatingSystem: "",
      Id: "4b9f0e0c6a1f4d2c9a7e5b3d1f0e2c4a",
      StartupWizardCompleted: true,
      ...overrides,
    },
  };
}
