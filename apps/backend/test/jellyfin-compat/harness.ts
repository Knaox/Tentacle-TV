/**
 * Le vocabulaire des suites : une FONCTIONNALITÉ (un `describe` au nom de son
 * identifiant de catalogue) et ses CONTRÔLES (des `it`). Chaque contrôle
 * consigne son verdict dans le fichier du passage ; `report.ts` en tire le
 * verdict de la fonctionnalité, puis celui de la version.
 *
 * Une fonctionnalité plus récente que la version éprouvée (`since`) n'est pas
 * jouée : elle est « sans objet », pas en échec.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { compareJellyfinVersions } from "../../src/services/jellyfinCompat/compatManifest";
import { loadContext } from "./context";
import { featureById } from "./features";

export type CheckStatus = "ok" | "partial" | "fail";

export interface CheckRecord {
  feature: string;
  check: string;
  status: CheckStatus;
  ms: number;
  /** Une réserve (contrôle passé mais incomplet) ou l'erreur d'un échec. */
  note?: string;
}

/** Un contrôle qui passe avec une réserve rend la fonctionnalité « partielle ». */
export interface Reserve {
  partial: string;
}

let current: string | null = null;

function record(rec: CheckRecord): void {
  appendFileSync(loadContext().recordFile, `${JSON.stringify(rec)}\n`);
}

/** Cette fonctionnalité existe-t-elle dans la version éprouvée ? */
export function applies(featureId: string): boolean {
  const since = featureById(featureId).since;
  return !since || compareJellyfinVersions(loadContext().jellyfin.version, since) >= 0;
}

export function feature(id: string, body: () => void): void {
  describe.skipIf(!applies(id))(id, () => {
    current = id;
    try {
      body();
      endpointsDocumented(id);
    } finally {
      current = null;
    }
  });
}

/**
 * Un contrôle. `skip` : il ne s'applique pas à cette instance (ex. l'auth
 * héritée n'est pas coupée) — ni joué, ni compté.
 */
export function check(name: string, fn: () => Promise<void | Reserve>, opts: { skip?: boolean; timeoutMs?: number } = {}): void {
  const featureId = current;
  if (!featureId) throw new Error(`contrôle « ${name} » hors d'une fonctionnalité`);
  it.skipIf(opts.skip === true)(name, async () => {
    const start = Date.now();
    try {
      const out = await fn();
      const partial = out && "partial" in out ? out.partial : undefined;
      record({ feature: featureId, check: name, status: partial ? "partial" : "ok", ms: Date.now() - start, ...(partial && { note: partial }) });
    } catch (err) {
      const note = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : String(err);
      record({ feature: featureId, check: name, status: "fail", ms: Date.now() - start, note });
      throw err;
    }
  }, opts.timeoutMs ?? 60_000);
}

/** Les endpoints que le catalogue déclare figurent-ils dans l'OpenAPI de l'instance ? */
function endpointsDocumented(id: string): void {
  const endpoints = featureById(id).endpoints;
  if (endpoints.length === 0) return;
  check("endpoints déclarés présents dans l'OpenAPI de l'instance", async () => {
    const doc = JSON.parse(readFileSync(loadContext().openapiFile, "utf8")) as { paths: Record<string, Record<string, unknown>> };
    const missing = endpoints.filter((e) => {
      const [method, path] = e.split(" ");
      return !doc.paths[path]?.[method.toLowerCase()];
    });
    if (missing.length > 0) throw new Error(`absents du document OpenAPI : ${missing.join(", ")}`);
  });
}
