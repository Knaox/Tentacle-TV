/**
 * Banc du moteur « Pour vous » — HORS LIGNE et rejouable, jamais lancé par
 * `pnpm test`. Depuis apps/backend, serveur ARRÊTÉ ou non (SQLite en WAL) :
 *
 *   pnpm bench:reco capture <jellyfinUserId-de-test>   # relève la bibliothèque (une fois)
 *   pnpm bench:reco find <texte>                         # cherche un titre de la bibliothèque
 *   pnpm bench:reco run <étiquette> [--offline] [--personas <dossier>] [persona…]
 *
 * Personas : test/reco-bench/personas/*.json (historique, attendus, à éviter),
 * plus, s'il est donné, un dossier de personas PRIVÉS hors du dépôt
 * (`--personas <dossier>` ou la variable RECO_BENCH_PRIVATE_PERSONAS) : le goût
 * réel d'une personne ne se publie pas. Le banc tourne avec ou sans lui.
 * Sorties : data/reco-bench/ (bibliothèque, bande TMDB, rapports par étiquette).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { initPrisma } from "../../src/services/db";
import { detectAppState } from "../../src/services/configStore";
import { idfMissesFacetFamilies, loadIdfFromDb, recomputeIdf } from "../../src/services/reco/idfStore";
import { universesOfMeta } from "../../src/services/reco/universes";
import {
  expectedHitRate, intraListDiversity, intrusions, novelty, orderCheck, popularityCalibration,
} from "../../src/services/reco/bench/benchMetrics";
import type { JudgedTitle } from "../../src/services/reco/bench/benchMetrics";
import type { Persona } from "../../src/services/reco/bench/benchPersona";
import { captureLibrary, loadLibrary, metasOf, runPersona } from "./harness";
import type { PersonaRun } from "./harness";
import { installTape } from "./tape";
import { setTitleLanguage } from "../../src/services/reco/titleLanguage";

const ROOT = resolve(__dirname, "../../data/reco-bench");
const LIBRARY = join(ROOT, "library.json");
const PERSONAS = resolve(__dirname, "personas");
const NOW = Date.UTC(2026, 9, 13, 12);
const TOP = 20;

/** Les dossiers de personas : ceux du dépôt, plus le dossier PRIVÉ s'il est donné (option, sinon variable). */
function personaDirs(args: string[]): string[] {
  const at = args.indexOf("--personas");
  const extra = at >= 0 ? args[at + 1] : process.env.RECO_BENCH_PRIVATE_PERSONAS;
  if (extra && !existsSync(extra)) throw new Error(`dossier de personas introuvable : ${extra}`);
  return extra ? [PERSONAS, resolve(extra)] : [PERSONAS];
}

function loadPersonas(dirs: string[], only: string[]): Persona[] {
  return dirs
    .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Persona))
    .filter((p) => only.length === 0 || only.includes(p.id));
}

interface Summary {
  persona: string;
  top20Intrusion: number;
  pageIntrusion: number;
  expectedOnPage: number;
  historyVotes: number;
  top20Votes: number;
  popularityJs: number;
  novelty: number;
  diversity: number;
  animeShare: number;
  /** L'ordre de « Pour vous » et « Films pour vous » suit-il la correspondance affichée ? */
  order: string;
}

async function judge(run: PersonaRun, keys: string[]): Promise<Map<string, JudgedTitle>> {
  const metas = await metasOf(keys);
  const facetsOf = new Map(run.pool.entries.map((e) => [e.candidate.key, e.candidate.facets.map((f) => f.key)]));
  const out = new Map<string, JudgedTitle>();
  for (const key of keys) {
    const meta = metas.get(key);
    out.set(key, {
      key,
      title: meta?.title ?? key,
      voteCount: meta?.voteCount ?? null,
      facetKeys: facetsOf.get(key) ?? [],
      universes: meta ? universesOfMeta(meta) : [],
    });
  }
  return out;
}

function fmt(n: number | undefined | null, digits = 2): string {
  return n === undefined || n === null || Number.isNaN(n) ? "—" : n.toFixed(digits);
}

async function benchPersona(persona: Persona, population: Persona[], label: string): Promise<Summary> {
  const library = loadLibrary(LIBRARY);
  const run = await runPersona(persona, library, population, NOW);
  const pageKeys = [...new Set(run.rows.flatMap((r) => r.items.map((i) => i.key)))];
  const forYou = run.rows.find((r) => r.key === "forYou")?.items ?? [];
  const historyKeys = persona.history.filter((e) => e.signal === "loved" || e.signal === "watched").map((e) => e.key);
  const judged = await judge(run, [...new Set([...pageKeys, ...historyKeys, ...persona.avoid.map((a) => a.key)])]);
  const top = forYou.slice(0, TOP).map((i) => judged.get(i.key)!).filter(Boolean);
  const page = pageKeys.map((k) => judged.get(k)!).filter(Boolean);
  const avoid = new Set(persona.avoid.map((a) => a.key));
  const universes = persona.avoidUniverses ?? [];
  const topIntrusions = intrusions(top, avoid, universes);
  const pageIntrusions = intrusions(page, avoid, universes);
  const expected = expectedHitRate(page, new Set(persona.expected.map((e) => e.key)));
  const calib = popularityCalibration(historyKeys.map((k) => judged.get(k)?.voteCount ?? null), top.map((t) => t.voteCount));
  const summary: Summary = {
    persona: persona.id,
    top20Intrusion: topIntrusions.rate,
    pageIntrusion: pageIntrusions.rate,
    expectedOnPage: expected.rate,
    historyVotes: calib.historyMedianVotes,
    top20Votes: calib.recoMedianVotes,
    popularityJs: calib.jsDivergence,
    novelty: novelty(top),
    diversity: intraListDiversity(top),
    animeShare: run.profile.animeShare,
    order: ["forYou", "forYouMovies"].map((key) => {
      const check = orderCheck((run.rows.find((r) => r.key === key)?.items ?? []).map((i) => (i as { match?: number }).match));
      return `${check.headIsBest ? "tête ok" : "TÊTE"} ${check.inversions} inv. ${check.worstGap} pts`;
    }).join(" / "),
  };

  // Le rapport lisible : la page servie, rangée par rangée, chaque titre avec sa raison et son score.
  const poolRank = new Map(run.pool.entries.map((e, i) => [e.candidate.key, i]));
  const entryOf = new Map(run.pool.entries.map((e) => [e.candidate.key, e]));
  const lines: string[] = [
    `# ${persona.label} — ${label}`, "",
    `Part d'animé ${fmt(run.profile.animeShare)} · signaux ${run.profile.signalCount} · absents de la bibliothèque : ${run.missing.join(", ") || "aucun"}`, "",
    "| Mesure | Valeur |", "|---|---|",
    `| Intrus top 20 (Pour vous) | ${fmt(summary.top20Intrusion)} |`,
    `| Intrus page entière | ${fmt(summary.pageIntrusion)} |`,
    `| Attendus présents sur la page | ${fmt(summary.expectedOnPage)} (${expected.found.join(", ") || "aucun"}) |`,
    `| Votes médians historique → top 20 | ${summary.historyVotes} → ${summary.top20Votes} (JS ${fmt(summary.popularityJs, 3)}) |`,
    `| Nouveauté top 20 | ${fmt(summary.novelty)} |`, `| Ordre Pour vous / Films pour vous | ${summary.order} |`, `| Diversité top 20 | ${fmt(summary.diversity, 3)} |`, "",
    "## Où sont les titres « à éviter » (et les attendus absents)", "",
  ];
  const watchList = [...persona.avoid, ...(persona.expected ?? []).filter((x) => !expected.found.includes(x.key)).map((x) => ({ ...x, title: `(attendu) ${x.title ?? x.key}` }))];
  for (const a of watchList) {
    const where = run.rows.flatMap((r) => r.items.map((it, i) => (it.key === a.key ? `${r.key}#${i + 1}` : null))).filter(Boolean);
    const e = entryOf.get(a.key);
    const b = e?.breakdown;
    lines.push(`- **${a.title ?? a.key}** : ${where.join(", ") || "absent de la page"} · rang pool ${poolRank.get(a.key) ?? "—"} · source ${e?.candidate.source ?? "—"}` +
      (b ? ` · total ${fmt(b.total)} = proximité ${fmt(b.relevance)} · graines ${fmt(b.seedSupport)} · refus ${fmt(b.negative)} · qualité ${fmt(b.quality)} · aversion ${fmt(b.aversion ?? 0)} · écart barre ${fmt(b.qualityGap ?? 0)} · votes ${e?.candidate.voteCount ?? "—"} · ${e?.candidate.facets.some((f) => f.key.startsWith("kw:")) ? "fiche" : "SANS fiche"} · ancres ${(b.topAnchors ?? []).map((t) => `${t.title}${t.similarity != null ? ` (${fmt(t.similarity)})` : ""}`).join(" / ")}` : ""));
  }
  lines.push("", "## Intrus du top 20", "", ...topIntrusions.intruders.map((i) => `- ${i.title} (${i.why})`), "", "## La page servie", "");
  for (const row of run.rows) {
    lines.push(`### ${row.key}${row.seedTitle ? ` — ${row.seedTitle}` : ""}`, "");
    for (const [i, item] of row.items.slice(0, 30).entries()) {
      const e = entryOf.get(item.key);
      const j = judged.get(item.key);
      const reason = item.reasons.map((r) => r.seedTitle ?? r.label ?? r.key ?? r.kind).join(" · ");
      const why = (item as { why?: unknown[] }).why;
      lines.push(`${i + 1}. ${item.title}${item.year ? ` (${item.year})` : ""} — ${item.source}${j?.universes.length ? ` [${j.universes.join(",")}]` : ""} · votes ${j?.voteCount ?? "—"}` +
        (e ? ` · total ${fmt(e.breakdown.total)} (prox ${fmt(e.breakdown.relevance)}, graines ${fmt(e.breakdown.seedSupport)}, refus ${fmt(e.breakdown.negative)}, aversion ${fmt(e.breakdown.aversion ?? 0)})` : "") +
        (e && !e.candidate.jellyfinItemId ? " · HORS BIB" : "") +
        (e ? ` · cite ${(e.breakdown.topAnchors ?? []).filter((t) => t.liked !== false).slice(0, 2).map((t) => `${t.title} ${fmt(t.similarity ?? 0)}`).join(" / ")}` : "") +
        ` · ${reason || "—"}${why ? ` · why ${JSON.stringify(why)}` : ""}${(item as { match?: number }).match !== undefined ? ` · ${(item as { match?: number }).match} %` : ""}`);
    }
    lines.push("");
  }
  const dir = join(ROOT, "reports", label);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${persona.id}.md`), lines.join("\n"));
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  mkdirSync(ROOT, { recursive: true });
  if (!(await initPrisma())) throw new Error("base indisponible");
  await detectAppState();
  await loadIdfFromDb();
  // Comme le serveur au démarrage : une table d'IDF d'avant une famille de facettes se recompte.
  if (command === "run" && idfMissesFacetFamilies()) console.log(`IDF recompté : ${JSON.stringify(await recomputeIdf())}`);
  if (command === "capture") {
    console.log(`bibliothèque relevée : ${await captureLibrary(args[0], LIBRARY)} titres`);
    return;
  }
  if (command === "find") {
    const needle = args.join(" ").toLowerCase();
    for (const e of loadLibrary(LIBRARY).filter((x) => x.name.toLowerCase().includes(needle))) {
      console.log(`${e.key}\t${e.name} (${e.ProductionYear ?? "?"})\t${e.mediaType === "tv" ? `${e.episodeCount} ép.` : ""}`);
    }
    return;
  }
  if (command !== "run") throw new Error("commande : capture | find | run");
  if (!existsSync(LIBRARY)) throw new Error("bibliothèque absente : lancer `capture` d'abord");
  const [label = "base", ...rest] = args;
  const offline = rest.includes("--offline");
  const stats = installTape(join(ROOT, "tmdb-tape"), offline ? "offline" : "auto");
  // Le serveur du banc parle français : ses listes TMDB aussi (cf. titleLanguage).
  setTitleLanguage("fr-FR");
  const dirs = personaDirs(rest);
  const named = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--personas");
  const population = loadPersonas(dirs, []);
  const personas = loadPersonas(dirs, named);
  console.log(`personas : ${personas.map((p) => p.id).join(", ")}${dirs.length > 1 ? " (dossier privé compris)" : ""}`);
  const summaries: Summary[] = [];
  for (const persona of personas) {
    const started = Date.now();
    summaries.push(await benchPersona(persona, population, label));
    console.log(`  ${persona.id} : ${Math.round((Date.now() - started) / 1000)} s`);
  }
  const table = [
    `| ${label} | intrus top 20 | intrus page | attendus | votes hist → top 20 | JS pop. | nouveauté | diversité | part animé | ordre (Pour vous / Films) |`,
    "|---|---|---|---|---|---|---|---|---|---|",
    ...summaries.map((s) => `| ${s.persona} | ${fmt(s.top20Intrusion)} | ${fmt(s.pageIntrusion)} | ${fmt(s.expectedOnPage)} | ${s.historyVotes} → ${s.top20Votes} | ${fmt(s.popularityJs, 3)} | ${fmt(s.novelty)} | ${fmt(s.diversity, 3)} | ${fmt(s.animeShare)} | ${s.order} |`),
  ].join("\n");
  writeFileSync(join(ROOT, "reports", label, "summary.md"), table + "\n");
  console.log(table);
  console.log(`bande TMDB : ${stats.replayed} rejouées, ${stats.recorded} enregistrées, ${stats.missing} absentes`);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error("[banc]", err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
