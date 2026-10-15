/**
 * Le JUGE du banc : chaque réponse de Tentacle à un compte est lue en entier —
 * aucun id, aucun nom d'un titre de la bibliothèque qui lui est interdit
 * (`leaksIn`), et chaque titre extérieur qu'elle porte doit être permis par
 * l'oracle (ou être la version d'un titre que Jellyfin lui montre). Il tient le
 * relevé (lignes « ok » / « ÉCHEC ») que le banc imprime et range.
 */

import { call, type CallResult, type Door } from "./doors";
import { externalTitlesIn, type ExternalOracle } from "./externalOracle";
import { leaksIn, type Reference } from "./reference";

export class Recorder {
  failures = 0;
  readonly lines: string[] = [];

  section(title: string): void {
    this.lines.push("", `— ${title}`);
    console.log(`\n— ${title}`);
  }

  note(ok: boolean, label: string): boolean {
    if (!ok) this.failures++;
    const line = `${ok ? "  ok " : "ÉCHEC"} ${label}`;
    this.lines.push(line);
    console.log(line);
    return ok;
  }
}

export interface JudgeContext {
  base: string;
  ref: Reference;
  /** Absent : pas de clé TMDB, les titres extérieurs ne sont pas jugés. */
  oracle: ExternalOracle | null;
  rec: Recorder;
}

export interface Expectation {
  /** Statuts acceptés (défaut : tout statut < 500). */
  status?: number[];
  /** Un compte LIBRE : rien à juger, seulement compter (témoin). */
  witness?: boolean;
}

/** Les titres que la requête nommait déjà (chemin `/movie/680`, corps `{ tmdbId }`) : leur écho n'est pas une fuite. */
function echoedTitles(path: string, body: unknown): Set<string> {
  const keys = new Set(externalTitlesIn(body).map((t) => `${t.mediaType}:${t.tmdbId}`));
  for (const m of path.matchAll(/(movie|tv)[/:](\d+)/g)) keys.add(`${m[1]}:${m[2]}`);
  for (const m of path.matchAll(/tmdbId=(\d+)&mediaType=(movie|tv)/g)) keys.add(`${m[2]}:${m[1]}`);
  return keys;
}

/** Les titres extérieurs fautifs d'une réponse, avec la raison. */
export async function externalLeaks(json: unknown, ctx: JudgeContext, echoed = new Set<string>()): Promise<{ count: number; leaks: string[] }> {
  const titles = externalTitlesIn(json);
  const leaks: string[] = [];
  for (const title of titles) {
    const key = `${title.mediaType}:${title.tmdbId}`;
    if (ctx.ref.visibleTmdb.has(key) || echoed.has(key)) continue;
    if (ctx.ref.forbiddenTmdb.has(key)) {
      leaks.push(`${key} (titre INTERDIT de la bibliothèque)`);
      continue;
    }
    if (!ctx.oracle) continue;
    const verdict = await ctx.oracle.verdict(title.mediaType, title.tmdbId);
    if (!verdict.allowed) leaks.push(`${key} (${verdict.why})`);
  }
  return { count: titles.length, leaks };
}

/** Appelle la route par la porte et juge la réponse. Rend le résultat (pour enchaîner). */
export async function probe(
  ctx: JudgeContext,
  door: Door,
  method: string,
  path: string,
  expect: Expectation = {},
  body?: unknown,
): Promise<CallResult> {
  const res = await call(ctx.base, door.token, method, path, body).catch((error: unknown) => ({ status: 0, text: String(error), json: null }));
  const statusOk = expect.status ? expect.status.includes(res.status) : res.status > 0 && res.status < 500;
  const label = `${door.label} · ${method} ${path} → ${res.status}`;
  if (expect.witness) {
    const externals = externalTitlesIn(res.json).length;
    ctx.rec.note(statusOk, `${label}${externals ? ` · ${externals} titre(s) extérieur(s)` : ""}`);
    return res;
  }
  const library = leaksIn(res.text, ctx.ref, `${decodeURIComponent(path)} ${JSON.stringify(body ?? "")}`);
  const external = await externalLeaks(res.json, ctx, echoedTitles(decodeURIComponent(path), body));
  const leaks = [...library, ...external.leaks];
  const detail = external.count ? ` · ${external.count} titre(s) extérieur(s) jugé(s)` : "";
  ctx.rec.note(statusOk && leaks.length === 0, `${label}${detail}${leaks.length ? ` · FUITE : ${leaks.join(" ; ")}` : ""}`);
  return res;
}

/** Les ids Jellyfin (normalisés) d'une liste `{ Items }` ou d'un tableau. */
export function itemIdsOf(json: unknown): string[] {
  const items = Array.isArray(json) ? json : (json as { Items?: unknown[] } | null)?.Items;
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const id = (item as { Id?: unknown })?.Id;
    return typeof id === "string" ? [id.toLowerCase().replace(/-/g, "")] : [];
  });
}
