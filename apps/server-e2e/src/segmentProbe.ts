import { authHeader } from "./jellyfin";
import { fetchWithin, waitFor } from "./stack";

/**
 * Ce que le banc des passages lit et touche, directement chez Jellyfin (jeton
 * administrateur) et chez Tentacle (session du compte) : l'état réel des trois
 * greffons, la configuration d'Intro Skipper, ses tâches.
 */
export const GUID = {
  introSkipper: "c83d86bba1e04c35a113e2101cf4ee6b",
  theIntroDb: "c9e41b9563e445e29db6b83df21ae5e7",
  skipMeDb: "b2a63e620ac545759ad22c7534ccb83d",
} as const;

type Json = Record<string, unknown>;

export class JellyfinPeek {
  constructor(readonly base: string, readonly token: string) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetchWithin(`${this.base}${path}`, { headers: authHeader(this.token) });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  async plugins(): Promise<Record<string, { status: string; version: string }>> {
    const list = await this.get<Array<{ Id: string; Status: string; Version: string }>>("/Plugins");
    return Object.fromEntries(list.map((p) => [p.Id.replace(/-/g, ""), { status: p.Status, version: p.Version }]));
  }

  config(guid: string): Promise<Json> {
    return this.get<Json>(`/Plugins/${guid}/Configuration`);
  }

  async setConfig(guid: string, patch: Json): Promise<void> {
    const current = await this.config(guid);
    const res = await fetchWithin(`${this.base}/Plugins/${guid}/Configuration`, {
      method: "POST",
      headers: { ...authHeader(this.token), "content-type": "application/json" },
      body: JSON.stringify({ ...current, ...patch }),
    });
    if (!res.ok) throw new Error(`configuration ${guid} → ${res.status}`);
  }

  async task(key: string): Promise<{ Id: string; Triggers: unknown[] } | undefined> {
    const tasks = await this.get<Array<{ Id: string; Key: string; Triggers: unknown[] }>>("/ScheduledTasks?isHidden=false");
    return tasks.find((task) => task.Key === key);
  }

  async setTriggers(key: string, triggers: unknown[]): Promise<void> {
    const task = await this.task(key);
    if (!task) throw new Error(`tâche ${key} absente`);
    await fetchWithin(`${this.base}/ScheduledTasks/${task.Id}/Triggers`, {
      method: "POST",
      headers: { ...authHeader(this.token), "content-type": "application/json" },
      body: JSON.stringify(triggers),
    });
  }
}

export interface Run {
  phase: string;
  running: boolean;
  plugins: Array<{ key: string; outcome: string | null }>;
  restart: string | null;
  configured: boolean | null;
  error: string | null;
}

export const outcomes = (run: Run) => Object.fromEntries(run.plugins.map((p) => [p.key, p.outcome]));

/** Suit un passage jusqu'au bout (le redémarrage de Jellyfin compris). */
export function followRun(read: () => Promise<Run>): Promise<Run> {
  return waitFor("la fin du passage des greffons", async () => {
    const run = await read();
    return run.running ? null : run;
  }, 6 * 60_000, 2_000);
}

/** Un appel à l'administration de Tentacle, avec le jeton du compte administrateur. */
export async function admin(base: string, token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetchWithin(`${base}/api/admin${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  }, 60_000);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texte brut */
  }
  return { status: res.status, body };
}
