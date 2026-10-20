/**
 * Le catalogue des scénarios et leur exécution. Chaque passage écrit
 * `.runs/wt/results-<horodatage>.json` et `.runs/wt/report.md` (tableau des
 * vérifications et des mesures), repris à la main dans le rapport de `docs/`.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUN_DIR } from "../env";
import { launchBrowser, ScenarioContext, type ScenarioResult } from "./context";
import { syncScenario } from "./sync";
import { inviteRaceScenario, inviteScenario, threeMembersScenario } from "./membership";
import { thirdDeviceScenario } from "./thirdDevice";
import { introGateScenario, slowStartScenario } from "./slowMember";
import { networkScenario } from "./network";
import { nextEpisodeScenario } from "./nextEpisode";
import { affinityScenario } from "./affinity";
import { seekHammerScenario } from "./seekHammer";
import { iosPairScenario, iosWebScenario } from "./mixed";
import { chatScenario } from "./chat";

export interface Scenario {
  id: string;
  title: string;
  run: (ctx: ScenarioContext) => Promise<void>;
}

export const SCENARIOS: Scenario[] = [
  { id: "invite", title: "Création, invitation, acceptation (interface)", run: inviteScenario },
  { id: "invite-race", title: "Invitation arrivée pendant le chargement de l'accueil", run: inviteRaceScenario },
  { id: "sync-direct", title: "Synchro en lecture directe : départ, régime, pause, lecture, seek, arrière-plan", run: (c) => syncScenario(c, false) },
  { id: "sync-transcode", title: "Synchro avec B en transcodage (1,5 Mb/s)", run: (c) => syncScenario(c, true) },
  { id: "seek-hammer", title: "Appuis → martelés : seul, puis en séance", run: seekHammerScenario },
  { id: "slow-start", title: "Membre lent à démarrer (transcodage + segments retardés)", run: slowStartScenario },
  { id: "intro-gate", title: "Intro au tout début : « Passer l'intro » tant que tous ne sont pas prêts", run: introGateScenario },
  { id: "third-device", title: "3ᵉ appareil du même compte", run: thirdDeviceScenario },
  { id: "three-members", title: "Groupe à trois, deux groupes en parallèle", run: threeMembersScenario },
  { id: "network", title: "Départ et retour réseau d'un membre", run: networkScenario },
  { id: "next-episode", title: "Fin d'épisode et épisode suivant", run: nextEpisodeScenario },
  { id: "chat", title: "Chat en rafale : réactions, messages, « est en train d'écrire »", run: chatScenario },
  { id: "ios-pair", title: "iPhone + iPad (simulateurs, app partagée, Hermes)", run: iosPairScenario },
  { id: "ios-web", title: "iPhone + web", run: iosWebScenario },
  { id: "affinity", title: "Mode affinité : séance, votes, lancement commun", run: affinityScenario },
];

function gitHead(): string {
  try {
    return execSync("git log -1 --format='%h %s'", { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

function markdown(results: ScenarioResult[], head: string): string {
  const lines = [`# Banc Watch Together — ${new Date().toISOString()}`, "", `Commit : \`${head}\``, ""];
  for (const r of results) {
    const failed = r.checks.filter((c) => !c.ok).length;
    lines.push(`## ${r.id} — ${r.title}`, "", `${r.error ? `**ERREUR** : ${r.error}  \n` : ""}${r.checks.length - failed}/${r.checks.length} vérifications · ${r.durationS} s`, "");
    if (r.checks.length) {
      lines.push("| Vérification | Résultat |", "|---|---|");
      for (const c of r.checks) lines.push(`| ${c.name} | ${c.ok ? "✔" : "✘"}${c.detail ? ` ${c.detail}` : ""} |`);
      lines.push("");
    }
    if (r.metrics.length) {
      lines.push("| Mesure | Valeur | Cible |", "|---|---|---|");
      for (const m of r.metrics) lines.push(`| ${m.name} | ${m.value} | ${m.target ?? ""} |`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export async function runScenarios(ids: string[]): Promise<boolean> {
  const chosen = ids.length ? SCENARIOS.filter((s) => ids.includes(s.id)) : SCENARIOS;
  const unknown = ids.filter((id) => !SCENARIOS.some((s) => s.id === id));
  if (unknown.length) throw new Error(`scénarios inconnus : ${unknown.join(", ")}`);
  const browser = await launchBrowser();
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of chosen) {
      const ctx = new ScenarioContext(scenario.id, browser);
      const started = Date.now();
      let error: string | undefined;
      ctx.log(`— ${scenario.title}`);
      try {
        await scenario.run(ctx);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        ctx.log(`ERREUR : ${error}`);
        await ctx.dump("erreur");
      } finally {
        await ctx.close();
      }
      results.push({
        id: scenario.id, title: scenario.title, startedAt: new Date(started).toISOString(),
        durationS: Math.round((Date.now() - started) / 1000), checks: ctx.checks, metrics: ctx.metrics, error,
      });
    }
  } finally {
    await browser.close();
  }
  const head = gitHead();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(RUN_DIR, `results-${stamp}.json`), JSON.stringify({ head, results }, null, 2));
  writeFileSync(join(RUN_DIR, "report.md"), markdown(results, head));
  console.log(`\nRapport : ${join(RUN_DIR, "report.md")}`);
  return results.every((r) => !r.error && r.checks.every((c) => c.ok));
}
