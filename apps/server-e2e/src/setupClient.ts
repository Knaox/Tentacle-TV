import { fetchWithin } from "./stack";

/**
 * Les appels de l'assistant (`/api/setup/*`), tels qu'un client les fait :
 * le corps et le statut, rien d'interprété. Chaque réponse est gardée pour
 * qu'un test puisse vérifier qu'aucun secret n'en est jamais sorti.
 */
export interface Reply {
  status: number;
  body: unknown;
  text: string;
}

export class SetupClient {
  session: string | null = null;
  readonly seen: string[] = [];

  constructor(readonly base: string) {}

  async call(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; withSession?: boolean } = {}): Promise<Reply> {
    const headers: Record<string, string> = { ...init.headers };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.withSession !== false && this.session) headers["x-tentacle-setup"] = this.session;
    // L'application (bibliothèques, compte) peut prendre du temps chez Jellyfin : une échéance large.
    const res = await fetchWithin(`${this.base}/api/setup${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    }, 90_000);
    const text = await res.text();
    this.seen.push(text);
    return { status: res.status, body: parseBody(text), text };
  }

  async open(code: string): Promise<Reply> {
    const reply = await this.call("/session", { method: "POST", body: { token: code }, withSession: false });
    if (reply.status === 200) this.session = (reply.body as { session: string }).session;
    return reply;
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const errorOf = (reply: Reply): string | null =>
  reply.body && typeof reply.body === "object" && "error" in reply.body ? String((reply.body as { error: unknown }).error) : null;
