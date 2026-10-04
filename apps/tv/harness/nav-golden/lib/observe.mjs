// Le RELEVÉ d'un pas : ce que la sonde voit (clé focalisée, libellé, cadre,
// route et pile, Modals) et les écritures du faux backend depuis le geste —
// une fois l'app STABLE : le même relevé pendant `quietMs`, après au moins
// `minMs`. Un relevé qui ne se stabilise pas est rendu tel quel, marqué.
import { sleep } from "./config.mjs";
import { httpJson } from "./processes.mjs";
import { agentRun, subsOf, tryEvaluate } from "./remote.mjs";
import { normalizeObservation } from "./substitute.mjs";
import { androidForeground } from "./android.mjs";

const POLL_MS = 150;
const NULL_FOCUS_QUIET_MS = 4000;

/** Numéro courant du journal du faux backend. */
export async function journalSeq(ctx) {
  return (await httpJson(`http://127.0.0.1:${ctx.ports.backend}/__peek`))?.json?.seq ?? 0;
}

async function writesSince(ctx, seq) {
  return (await httpJson(`http://127.0.0.1:${ctx.ports.backend}/__journal?since=${seq}`))?.json?.writes ?? [];
}

/**
 * Le cadre ramené à l'espace de la référence (tvOS : 1920 points de large) :
 * Android mesure en dp (960 de large à 320 ppp, sauf densité réglée par
 * l'app). Sans largeur connue, tel quel.
 */
const REFERENCE_WIDTH = 1920;
function scaledFrame(frame, windowWidth) {
  if (!Array.isArray(frame) || !windowWidth || windowWidth === REFERENCE_WIDTH) return frame ?? null;
  const k = REFERENCE_WIDTH / windowWidth;
  return frame.map((v) => Math.round(v * k));
}

/** Le relevé brut de la sonde, ramené à ce que le banc compare. */
function normalize(raw, writes, app = "foreground") {
  const focus = raw?.focus ?? {};
  return {
    app,
    focus: focus.key ?? null,
    label: focus.label ?? null,
    frame: scaledFrame(focus.frame, raw?.window?.width),
    groups: focus.groups ?? [],
    route: raw?.route ?? null,
    params: raw?.params ?? null,
    stack: raw?.stack ?? [],
    panel: raw?.modals?.length ? raw.modals.map((m) => m.key ?? m.owner ?? "?") : null,
    panelOwners: raw?.modals?.map((m) => m.owner) ?? [],
    writes,
    ...(raw?.texts ? { texts: raw.texts } : {}),
    ...(raw?.storage ? { storage: raw.storage } : {}),
  };
}

/** L'app est-elle passée en arrière-plan (Menu à la racine) ? L'agent le dit. */
async function appInBackground(ctx) {
  if (ctx.android) return !androidForeground(ctx);
  try {
    const [reply] = await agentRun(ctx, ["focus"], { timeoutMs: 15_000 });
    return String(reply?.info ?? "").startsWith("background:");
  } catch {
    return false;
  }
}

const signature = (obs) => JSON.stringify([obs.focus, obs.label, obs.frame, obs.route, obs.params, obs.stack, obs.panel, obs.writes, obs.texts, obs.storage]);

/**
 * Attend l'app stable et rend le relevé. `since` : numéro du journal avant le
 * geste ; `texts` : les textes d'`expect.text` à chercher à l'écran.
 */
export async function settle(ctx, { since, minMs = 0, quietMs = 500, timeoutMs = 8000, texts = [], storage = [], nullQuietMs = NULL_FOCUS_QUIET_MS }) {
  const start = Date.now();
  const query = `globalThis.__navGolden ? globalThis.__navGolden.observe(${JSON.stringify({ texts, storage })}) : null`;
  let last = null;
  let lastSig = null;
  let stableSince = Date.now();
  let silentSince = null;
  for (;;) {
    const raw = await tryEvaluate(ctx, query);
    if (!raw) {
      // Une sonde muette : app suspendue en arrière-plan (sortie), ou en plein redémarrage.
      silentSince ??= Date.now();
      if (Date.now() - silentSince > 1500 && (await appInBackground(ctx))) {
        return { ...normalize(null, await writesSince(ctx, since), "background"), settleMs: Date.now() - start };
      }
    } else {
      silentSince = null;
    }
    // Les adresses de la place ramenées à leur nom : la référence ne dépend pas de la place.
    const obs = normalizeObservation(normalize(raw, await writesSince(ctx, since)), subsOf(ctx));
    const sig = raw ? signature(obs) : null;
    const now = Date.now();
    if (sig !== null && sig === lastSig) {
      // Aucun focus (écran qui charge encore) : on le confirme plus longtemps avant d'y croire.
      const quiet = obs.focus === null && obs.app !== "background" ? Math.max(quietMs, nullQuietMs) : quietMs;
      if (now - stableSince >= quiet && now - start >= minMs) return { ...obs, settleMs: now - start };
    } else {
      lastSig = sig;
      stableSince = now;
    }
    last = obs;
    if (now - start > timeoutMs) return { ...last, settleMs: now - start, unsettled: true };
    await sleep(POLL_MS);
  }
}

/** Le genre d'une écriture : `watchlist:add @id` → `watchlist:add`. */
const kindOf = (write) => write.split(" @")[0];

/**
 * Les écritures attendues d'un pas, comme un multiensemble (l'ordre de deux
 * requêtes parallèles varie) ; un attendu sans `@item` ne compare que le genre.
 */
function writesMatch(expected, observed) {
  if (expected.length !== observed.length) return false;
  const left = [...observed];
  const fits = (want, got) => (want.includes(" @") ? want === got : kindOf(got) === want || kindOf(got).startsWith(`${want}:`));
  // Les attendus précis d'abord : un attendu de genre ne prend pas la place d'un précis.
  for (const want of [...expected].sort((a, b) => Number(b.includes(" @")) - Number(a.includes(" @")))) {
    const at = left.findIndex((got) => fits(want, got));
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}

const near = (want, got) => want === null || (typeof got === "number" && Math.abs(want - got) <= 2);

/** Ce que l'auteur affirme (`expect`), contre le relevé : la liste des écarts. */
export function checkExpect(expect = {}, obs, texts = []) {
  const failures = [];
  const fail = (field, want, got) => failures.push({ field, want, got });
  if ("focus" in expect && expect.focus !== obs.focus) fail("focus", expect.focus, obs.focus);
  if ("label" in expect && expect.label !== obs.label) fail("label", expect.label, obs.label);
  if ("app" in expect && expect.app !== obs.app) fail("app", expect.app, obs.app);
  if ("storage" in expect) {
    for (const [key, want] of Object.entries(expect.storage)) {
      const got = obs.storage?.[key] ?? null;
      const wanted = want !== null && typeof want === "object" ? JSON.stringify(want) : want;
      if (got !== wanted) fail(`storage.${key}`, wanted, got);
    }
  }
  if ("route" in expect && expect.route !== obs.route) fail("route", expect.route, obs.route);
  if ("stack" in expect && JSON.stringify(expect.stack) !== JSON.stringify(obs.stack)) fail("stack", expect.stack, obs.stack);
  if ("params" in expect) {
    const got = obs.params ?? {};
    if (Object.entries(expect.params).some(([k, v]) => JSON.stringify(got[k]) !== JSON.stringify(v))) fail("params", expect.params, obs.params);
  }
  if ("panel" in expect && (expect.panel === "open") !== Boolean(obs.panel)) fail("panel", expect.panel, obs.panel ? "open" : "closed");
  if ("writes" in expect && !writesMatch(expect.writes, obs.writes)) fail("writes", expect.writes, obs.writes);
  if ("frame" in expect && !(obs.frame && expect.frame.every((v, i) => near(v, obs.frame[i])))) fail("frame", expect.frame, obs.frame);
  if ("text" in expect) {
    [].concat(expect.text).forEach((text) => {
      const found = obs.texts?.[texts.indexOf(text)];
      if (!found) fail("text", text, "absent de l'écran");
    });
  }
  return failures;
}
