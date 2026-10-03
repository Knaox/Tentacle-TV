// Les références (`<nom>.golden.json`, à côté du fichier de scénarios) :
// `record` les écrit sur le code de RÉFÉRENCE — chaque scénario joué deux
// fois, les champs qui varient d'un passage à l'autre marqués instables —,
// `verify` rejoue le dossier courant et compare. Jamais écrites à la main.
import fs from "node:fs";
import { note, warn } from "./config.mjs";
import { CRITICAL, diffObservation, notesOf, unstableFields } from "./compare.mjs";
import { hashScenario } from "./scenarios.mjs";
import { runScenario } from "./runner.mjs";

const FORMAT = 1;
/**
 * La version de ce que la sonde RELÈVE. À monter à chaque changement de la
 * sonde ou du relevé qui peut changer une valeur enregistrée (v2 : les textes
 * des fibres hôtes texte, 2026-10-03) : `verify` refuse alors les références
 * plus anciennes, « à réenregistrer », au lieu de les comparer à tort.
 */
export const OBSERVATION_VERSION = 2;
const KEPT = ["app", "focus", "label", "frame", "groups", "route", "params", "stack", "panel", "panelOwners", "writes", "texts", "storage", "unsettled"];
const strip = (obs) => Object.fromEntries(KEPT.filter((k) => obs[k] !== undefined).map((k) => [k, obs[k]]));

export function readGolden(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Les champs instables de chaque pas (et de l'entrée), sur plusieurs passages. */
function instability(runs) {
  const [first, ...others] = runs;
  const start = [...new Set(others.flatMap((run) => unstableFields(first.start, run.start)))];
  const steps = {};
  first.steps.forEach((step, i) => {
    const fields = [...new Set(others.flatMap((run) => (run.steps[i] ? unstableFields(step.obs, run.steps[i].obs) : ["focus"])))];
    if (fields.length) steps[i] = fields;
  });
  return { start, steps };
}

/**
 * Les passages d'un enregistrement. S'ils divergent sur l'essentiel (ou si le
 * banc échoue), une REPRISE de tout le jeu de passages (`retries`) : un Mac
 * chargé, une autre session qui rouvre Simulator.app, et l'app passe derrière
 * l'accueil de tvOS le temps d'un passage.
 */
async function recordRuns(ctx, session, suite, scenario, repeat, retries) {
  for (let attempt = 0; ; attempt++) {
    try {
      const runs = [];
      for (let r = 0; r < repeat; r++) runs.push(await runScenario(ctx, session, suite, scenario));
      const unstable = instability(runs);
      const critical = [...unstable.start, ...Object.values(unstable.steps).flat()].filter((f) => CRITICAL.has(f));
      if (!critical.length || attempt >= retries) return { runs, unstable, critical, attempts: attempt + 1 };
    } catch (error) {
      if (attempt >= retries) throw error;
    }
  }
}

export async function recordSuites(ctx, session, suites, { repeat = 2, retries = 1, onResult }) {
  const results = [];
  for (const suite of suites) {
    const golden = readGolden(suite.golden) ?? {};
    const entries = { ...(golden.scenarios ?? {}) };
    for (const scenario of suite.scenarios) {
      if (scenario.skip) {
        results.push(onResult({ suite, scenario, status: "skipped", reason: scenario.skip }));
        continue;
      }
      let recorded;
      try {
        recorded = await recordRuns(ctx, session, suite, scenario, repeat, retries);
      } catch (error) {
        results.push(onResult({ suite, scenario, status: "error", error: error.message }));
        continue;
      }
      const { runs, unstable, critical, attempts } = recorded;
      const [run] = runs;
      const expectFailures = run.steps.flatMap((s, i) => s.failures.map((f) => ({ step: i + 1, ...f })));
      entries[scenario.id] = {
        hash: hashScenario(scenario),
        durationMs: run.durationMs,
        start: strip(run.start),
        steps: run.steps.map((s) => ({ do: s.do, ...strip(s.obs) })),
        ...(unstable.start.length || Object.keys(unstable.steps).length ? { unstable } : {}),
        ...(expectFailures.length ? { expectFailures } : {}),
        ...(run.preconditions.length ? { preconditions: run.preconditions } : {}),
      };
      const status = critical.length ? "flaky" : run.preconditions.length ? "precondition" : expectFailures.length ? "expect" : "recorded";
      results.push(onResult({ suite, scenario, status, durationMs: run.durationMs, unstable, expectFailures, preconditions: run.preconditions, retried: attempts > 1 }));
    }
    const ordered = Object.fromEntries(suite.scenarios.map((s) => [s.id, entries[s.id]]).filter(([, v]) => v));
    for (const [id, value] of Object.entries(entries)) if (!(id in ordered)) ordered[id] = value;
    const out = {
      format: FORMAT,
      domain: suite.domain,
      suite: suite.name,
      reference: { sha: session.checkout.sha, label: session.checkout.label },
      observation: OBSERVATION_VERSION,
      dataset: session.snapshot.hash,
      native: session.fingerprint,
      device: session.deviceInfo,
      recordedAt: new Date().toISOString(),
      scenarios: ordered,
    };
    fs.writeFileSync(suite.golden, `${JSON.stringify(out, null, 2)}\n`);
    note(`référence écrite : ${suite.domain}/${suite.name}.golden.json`);
  }
  return results;
}

const FAILED = new Set(["diff", "expect", "error"]);

/** Un passage de vérification d'un scénario contre sa référence. */
async function verifyOnce(ctx, session, suite, scenario, entry) {
  let run;
  try {
    run = await runScenario(ctx, session, suite, scenario);
  } catch (error) {
    return { status: "error", error: error.message };
  }
  const diffs = [];
  const notes = [];
  for (const d of diffObservation(entry.start, run.start, entry.unstable?.start ?? [])) diffs.push({ step: 0, ...d });
  run.steps.forEach((s, i) => {
    const ref = entry.steps[i];
    if (!ref) return diffs.push({ step: i + 1, field: "pas", golden: null, observed: "pas absent de la référence" });
    for (const d of diffObservation(ref, s.obs, entry.unstable?.steps?.[i] ?? [])) diffs.push({ step: i + 1, do: s.do, ...d });
    for (const n of notesOf(ref, s.obs)) notes.push({ step: i + 1, ...n });
  });
  const known = new Set((entry.expectFailures ?? []).map((f) => `${f.step}:${f.field}`));
  const expectFailures = run.steps.flatMap((s, i) => s.failures.map((f) => ({ step: i + 1, ...f }))).filter((f) => !known.has(`${f.step}:${f.field}`));
  const stale = entry.hash !== hashScenario(scenario);
  const status = diffs.length ? "diff" : expectFailures.length ? "expect" : stale ? "stale" : "ok";
  return { status, durationMs: run.durationMs, diffs, notes, expectFailures, stale };
}

export async function verifySuites(ctx, session, suites, { retries = 1, onResult }) {
  const results = [];
  for (const suite of suites) {
    const golden = readGolden(suite.golden);
    if (golden && golden.dataset !== session.snapshot.hash) {
      warn(`${suite.domain}/${suite.name} : référence enregistrée sur les données ${golden.dataset}, banc sur ${session.snapshot.hash} — comparaison sans valeur`);
    }
    if (golden?.device?.model && golden.device.model !== session.deviceInfo.model) warn(`${suite.domain}/${suite.name} : référence prise sur ${golden.device.model}, rejouée sur ${session.deviceInfo.model}`);
    const obsolete = golden && (golden.observation ?? 1) !== OBSERVATION_VERSION;
    for (const scenario of suite.scenarios) {
      const entry = golden?.scenarios?.[scenario.id];
      if (scenario.skip) {
        results.push(onResult({ suite, scenario, status: "skipped", reason: scenario.skip }));
        continue;
      }
      if (!entry) {
        results.push(onResult({ suite, scenario, status: "missing" }));
        continue;
      }
      if (obsolete) {
        const reason = `référence prise par une sonde plus ancienne (relevé v${golden.observation ?? 1}, banc v${OBSERVATION_VERSION}) : à réenregistrer`;
        results.push(onResult({ suite, scenario, status: "obsolete", reason }));
        continue;
      }
      let outcome = null;
      let first = null;
      for (let attempt = 0; attempt <= retries && (!outcome || FAILED.has(outcome.status)); attempt++) {
        if (outcome) first ??= { status: outcome.status, diffs: outcome.diffs ?? [], error: outcome.error };
        outcome = { ...(await verifyOnce(ctx, session, suite, scenario, entry)), retried: attempt > 0 };
      }
      // Passé au 2e essai : le 1er reste dit (une instabilité, même rattrapée, se voit).
      results.push(onResult({ suite, scenario, ...outcome, ...(first ? { firstAttempt: first } : {}) }));
    }
  }
  return results;
}
