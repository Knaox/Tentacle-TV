// Rejouer un scénario : démarrage à froid sur ses données, approche
// (`start`), puis chaque pas — geste(s), attente de stabilité, relevé,
// attendus de l'auteur. Le même déroulé sert `record` (sur la référence) et
// `verify` (sur le dossier courant) ; seule la suite diffère (golden.mjs).
import { BenchError, sleep } from "./config.mjs";
import { checkExpect, journalSeq, settle } from "./observe.mjs";
import { evaluate, perform } from "./remote.mjs";
import { coldStart } from "./session.mjs";

const BETWEEN_GESTURES_MS = 150;
const DEFAULT_TIMEOUT_MS = 8000;

/** Les textes et clés de stockage qu'un pas demande de relever. */
const textsOf = (step) => (step?.expect?.text === undefined ? [] : [].concat(step.expect.text));
const storageOf = (step) => Object.keys(step?.expect?.storage ?? {});

async function play(ctx, gestures) {
  let extra = 0;
  for (const [i, gesture] of gestures.entries()) {
    if (i > 0) await sleep(BETWEEN_GESTURES_MS);
    extra = await perform(ctx, gesture);
  }
  return extra;
}

/**
 * Déroule le scénario ; rend `{ start, steps: [{ obs, failures }], preconditions, durationMs }`.
 * Une erreur du banc (agent muet, sonde absente) remonte : le scénario n'a rien prouvé.
 */
export async function runScenario(ctx, session, suite, scenario) {
  const began = Date.now();
  const start = scenario.start ?? {};
  await coldStart(ctx, session, start);
  const preconditions = [];
  if (start.route) {
    const done = await evaluate(ctx, `globalThis.__navGolden.navigate(${JSON.stringify(start.route.name)}, ${JSON.stringify(start.route.params ?? null)}, ${start.route.reset === true})`);
    if (!done) throw new BenchError(`start.route : navigation impossible vers ${start.route.name}`);
  }
  const seq0 = await journalSeq(ctx);
  // L'approche, geste par geste : chacun attend une app immobile (300 ms), pour
  // qu'un appui ne parte jamais vers un écran qui n'est pas encore là.
  let approachExtra = 0;
  for (const gesture of start.keys ?? []) {
    approachExtra = await perform(ctx, gesture);
    await settle(ctx, { since: seq0, minMs: approachExtra, quietMs: 300, timeoutMs: 6000 });
  }
  const startObs = start.route || start.keys?.length
    // Une page poussée ou atteinte par l'approche charge encore ses données : son focus
    // d'entrée peut se poser tard — on le veut immobile 1,5 s avant d'y croire.
    ? await settle(ctx, { since: seq0, minMs: 800 + approachExtra, quietMs: 1500, timeoutMs: 30_000 })
    : await settle(ctx, { since: seq0, quietMs: 600, timeoutMs: 15_000 });
  if (start.focus && startObs.focus !== start.focus) preconditions.push({ field: "start.focus", want: start.focus, got: startObs.focus });
  if (start.screen && startObs.route !== start.screen) preconditions.push({ field: "start.screen", want: start.screen, got: startObs.route });

  const steps = [];
  for (const step of scenario.steps) {
    const since = await journalSeq(ctx);
    const extra = await play(ctx, [].concat(step.do));
    const obs = await settle(ctx, {
      since,
      minMs: (step.settleMs ?? suite.defaults?.settleMs ?? 0) + extra,
      timeoutMs: step.timeoutMs ?? suite.defaults?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      texts: textsOf(step),
      storage: storageOf(step),
    });
    steps.push({ do: step.do, obs, failures: checkExpect(step.expect, obs, textsOf(step)) });
  }
  return { start: startObs, steps, preconditions, durationMs: Date.now() - began };
}
