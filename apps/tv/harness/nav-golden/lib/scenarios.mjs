// Les scénarios : `scenarios/<domaine>/<nom>.json` (les `*.json` À LA RACINE
// du dossier du domaine — ni `*.golden.json`, ni les sous-dossiers, où un
// domaine range ce qui n'est pas un scénario du simulateur), validés STRICTEMENT
// avant tout lancement : une faute de frappe ne doit pas devenir une
// référence muette. Le format : `docs/tv-navigation/banc.md`.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BenchError, SCENARIOS_DIR } from "./config.mjs";
import { gestureError } from "./remote.mjs";

const SCENARIO_KEYS = new Set(["id", "title", "why", "rules", "notes", "tags", "skip", "start", "steps", "fakeBackendOnly"]);
const START_KEYS = new Set(["session", "fixtures", "route", "keys", "focus", "storage", "screen", "data"]);
const STEP_KEYS = new Set(["do", "expect", "settleMs", "why", "note", "timeoutMs"]);
const EXPECT_KEYS = new Set(["focus", "label", "route", "stack", "params", "panel", "writes", "text", "frame", "app", "storage"]);

export const goldenPathOf = (suitePath) => suitePath.replace(/\.json$/, ".golden.json");
export const hashScenario = (scenario) => crypto.createHash("sha256").update(JSON.stringify({ start: scenario.start ?? {}, steps: scenario.steps })).digest("hex").slice(0, 12);

export function listDomains() {
  if (!fs.existsSync(SCENARIOS_DIR)) return [];
  return fs.readdirSync(SCENARIOS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function suiteFiles(domain) {
  const dir = path.join(SCENARIOS_DIR, domain);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".golden.json") && fs.statSync(path.join(dir, f)).isFile()).sort();
}

/** Les erreurs d'un scénario (liste vide : valide). */
function validateScenario(scenario, domain, errors) {
  const where = `${domain}#${scenario?.id ?? "?"}`;
  const fail = (text) => errors.push(`${where} : ${text}`);
  if (typeof scenario?.id !== "string" || !scenario.id) return fail("`id` manquant");
  for (const key of Object.keys(scenario)) if (!SCENARIO_KEYS.has(key)) fail(`clé inconnue « ${key} »`);
  if (typeof scenario.title !== "string") fail("`title` manquant");
  const start = scenario.start ?? {};
  for (const key of Object.keys(start)) if (!START_KEYS.has(key)) fail(`start : clé inconnue « ${key} »`);
  if (start.session && !["paired", "none"].includes(start.session)) fail("start.session : paired | none");
  for (const name of start.fixtures ?? []) if (!/^[\w-]+\/[\w.-]+$/.test(name)) fail(`start.fixtures : « ${name} » n'est pas <domaine>/<jeu>`);
  if (start.route && typeof start.route.name !== "string") fail("start.route.name manquant");
  for (const key of Object.keys(start.route ?? {})) if (!["name", "params", "reset"].includes(key)) fail(`start.route : clé inconnue « ${key} »`);
  for (const gesture of start.keys ?? []) {
    const error = gestureError(gesture);
    if (error) fail(`start.keys : ${error}`);
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) return fail("`steps` vide");
  scenario.steps.forEach((s, i) => {
    for (const key of Object.keys(s)) if (!STEP_KEYS.has(key)) fail(`pas ${i + 1} : clé inconnue « ${key} »`);
    if (s.do === undefined) return fail(`pas ${i + 1} : \`do\` manquant`);
    for (const gesture of [].concat(s.do)) {
      const error = gestureError(gesture);
      if (error) fail(`pas ${i + 1} : ${error}`);
    }
    for (const key of Object.keys(s.expect ?? {})) if (!EXPECT_KEYS.has(key)) fail(`pas ${i + 1} : expect.${key} inconnu`);
    if (s.expect?.panel && !["open", "closed"].includes(s.expect.panel)) fail(`pas ${i + 1} : expect.panel : open | closed`);
    if (s.expect?.writes && !Array.isArray(s.expect.writes)) fail(`pas ${i + 1} : expect.writes est une liste`);
    if (s.expect?.frame && (!Array.isArray(s.expect.frame) || s.expect.frame.length !== 4)) fail(`pas ${i + 1} : expect.frame = [x, y, l, h]`);
    if (s.expect?.app && !["foreground", "background"].includes(s.expect.app)) fail(`pas ${i + 1} : expect.app : foreground | background`);
  });
}

/** Lit et valide un fichier de scénarios. */
export function loadSuite(domain, file) {
  const full = path.join(SCENARIOS_DIR, domain, file);
  let suite;
  try {
    suite = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    return { domain, file, path: full, scenarios: [], errors: [`${domain}/${file} : JSON illisible — ${error.message}`] };
  }
  const errors = [];
  if (suite.domain !== domain) errors.push(`${domain}/${file} : « domain » vaut « ${suite.domain} », le dossier « ${domain} »`);
  if (!Array.isArray(suite.scenarios)) errors.push(`${domain}/${file} : « scenarios » doit être une liste`);
  const scenarios = (suite.scenarios ?? []).map((s) => ({ ...s, steps: s.steps ?? [] }));
  const seen = new Set();
  for (const scenario of scenarios) {
    validateScenario(scenario, domain, errors);
    if (seen.has(scenario.id)) errors.push(`${domain}#${scenario.id} : identifiant en double`);
    seen.add(scenario.id);
  }
  const defaults = suite.defaults ?? {};
  return { domain, file, name: file.replace(/\.json$/, ""), path: full, golden: goldenPathOf(full), defaults, scenarios, errors };
}

/**
 * Les suites visées : rien = tous les domaines ; `<domaine>`,
 * `<domaine>/<fichier>`, `<domaine>#<id>` ou `<domaine>/<fichier>#<id>`.
 */
export function selectSuites(targets = []) {
  const all = listDomains().flatMap((domain) => suiteFiles(domain).map((file) => loadSuite(domain, file)));
  if (targets.length === 0) return all;
  const picked = [];
  for (const target of targets) {
    const [where, id] = target.split("#");
    const [domain, name] = where.split("/");
    const suites = all.filter((s) => s.domain === domain && (!name || s.name === name.replace(/\.json$/, "")));
    if (suites.length === 0) throw new BenchError(`cible inconnue : ${target} (domaines : ${listDomains().join(", ") || "aucun"})`);
    for (const suite of suites) {
      const scenarios = id ? suite.scenarios.filter((s) => s.id === id) : suite.scenarios;
      if (id && scenarios.length === 0 && name) throw new BenchError(`scénario inconnu : ${target}`);
      if (scenarios.length) picked.push({ ...suite, scenarios });
    }
  }
  if (picked.length === 0) throw new BenchError(`aucun scénario pour ${targets.join(" ")}`);
  return picked;
}
