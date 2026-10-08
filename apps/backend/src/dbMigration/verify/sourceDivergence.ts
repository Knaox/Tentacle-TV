import { MariadbReader } from "../legacySource/mariadbReader";
import { sameIdentity, sourceIdentity } from "../legacySource/sourceConfig";
import { judgeSource } from "../legacySource/sourceFloor";
import type { CoreModel } from "../copy/coreModels";
import { classifyTables, HOST_BOOKKEEPING_TABLES } from "../copy/tableClassification";
import { corePlan, extensionPlan, type PlanContext } from "../copy/tablePlans";
import { pageSizeFor } from "../copy/tableCopy";
import type { MigrationReport } from "../migrationReport";
import { RowFingerprint } from "./checksums";

/**
 * La source a-t-elle changé depuis la migration (§ 3.10) ? Une image d'avant
 * remise en service le temps d'un retour arrière a écrit dans MariaDB ; la
 * remettre à jour ne doit JAMAIS ignorer ces écritures en silence.
 *
 * - identité (hôte, port, base) différente de celle du rapport → `identity` ;
 * - source vide à la migration, qui a maintenant des tables du cœur → `was_empty` ;
 * - lignes ou contenu d'une table hors caches différents de l'empreinte → `data`.
 *
 * Une source injoignable n'est pas une divergence : c'est le cas normal une fois
 * MariaDB retirée. Rien n'est jamais fait automatiquement : l'admin le voit dans
 * « À régler » et peut demander une nouvelle migration (la base actuelle en .bak).
 */
export type SourceCheck =
  | { status: "none" }
  | { status: "unreachable" }
  | { status: "same" }
  | { status: "changed"; why: "identity" | "data" | "was_empty" };

export interface DivergenceInput {
  url: string | null;
  report: MigrationReport | null;
  fingerprint: Record<string, { rows: number; sum: string }> | null;
  models: CoreModel[];
  /** Hors empreinte : les caches et la table copiée en fond. */
  ignored: ReadonlySet<string>;
}

export async function currentFingerprint(reader: MariadbReader, models: CoreModel[], ignored: ReadonlySet<string>) {
  const tables = await reader.tables();
  const coreNames = models.map((m) => m.table);
  const fates = classifyTables(tables.map((t) => t.name), coreNames, [...coreNames, ...HOST_BOOKKEEPING_TABLES]);
  const ctx: PlanContext = { sourceZone: reader.sourceZone, startedAt: 0, zeroDates: new Map() };
  const byName = new Map(tables.map((t) => [t.name, t]));
  const modelBy = new Map(models.map((m) => [m.table, m]));
  const result: Record<string, { rows: number; sum: string }> = {};
  for (const fate of fates) {
    if ((fate.fate !== "core" && fate.fate !== "extension") || ignored.has(fate.name)) continue;
    const source = byName.get(fate.name)!;
    const plan = fate.fate === "core" ? corePlan(modelBy.get(fate.name)!, source, ctx) : extensionPlan(source, ctx);
    const keys = source.keyColumns.map((k) => plan.sourceColumns.findIndex((c) => c.name === k && !c.fromZone));
    const fp = new RowFingerprint();
    const size = pageSizeFor(source);
    let after: unknown[] | null = null;
    let offset = 0;
    for (;;) {
      const page = await reader.page(source, plan.sourceColumns, { after }, size, offset);
      for (const raw of page) fp.add(raw);
      if (page.length < size) break;
      if (keys.length) after = keys.map((i) => page[page.length - 1][i]);
      else offset += page.length;
    }
    result[fate.name] = fp.result();
  }
  return { result, verdict: judgeSource(tables.map((t) => t.name), coreNames).kind };
}

function sameFingerprint(a: Record<string, { rows: number; sum: string }>, b: Record<string, { rows: number; sum: string }>): boolean {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const name of names) {
    const x = a[name];
    const y = b[name];
    // Une table vide apparue ou disparue ne change rien aux données.
    if ((!x && y?.rows === 0) || (!y && x?.rows === 0)) continue;
    if (!x || !y || x.rows !== y.rows || x.sum !== y.sum) return false;
  }
  return true;
}

export async function checkSourceDivergence(input: DivergenceInput): Promise<SourceCheck> {
  if (!input.url || !input.report) return { status: "none" };
  if (!sameIdentity(sourceIdentity(input.url), input.report.source.identity)) return { status: "changed", why: "identity" };
  let reader: MariadbReader;
  try {
    reader = await MariadbReader.open(input.url);
  } catch {
    return { status: "unreachable" };
  }
  try {
    const now = await currentFingerprint(reader, input.models, input.ignored);
    if (input.report.sourceEmpty) return now.verdict === "empty" ? { status: "same" } : { status: "changed", why: "was_empty" };
    return sameFingerprint(input.fingerprint ?? {}, now.result) ? { status: "same" } : { status: "changed", why: "data" };
  } finally {
    await reader.close().catch(() => undefined);
  }
}
