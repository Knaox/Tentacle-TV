// Parler à l'app : la télécommande (agent XCUITest d'atv-remote, de vrais
// appuis UIKit) et le runtime JS (démon CDP, la sonde du banc). Et le
// vocabulaire des gestes d'un scénario, traduit en ordres.
import { BenchError, sleep } from "./config.mjs";
import { httpJson } from "./processes.mjs";

/** Évalue une expression dans le runtime de l'app ; rend sa valeur (JSON). */
export async function evaluate(ctx, expression, { timeoutMs = 15_000 } = {}) {
  const res = await httpJson(`http://127.0.0.1:${ctx.ports.cdp}/cdp`, {
    method: "POST", body: { method: "Runtime.evaluate", params: { expression, returnByValue: true } }, timeoutMs,
  });
  const reply = res?.json;
  if (!reply || reply.error) throw new BenchError(`CDP : ${reply?.error ?? "pas de réponse du démon"}`);
  if (reply.exceptionDetails) throw new BenchError(`CDP : exception — ${JSON.stringify(reply.exceptionDetails).slice(0, 400)}`);
  return reply.result?.value;
}

/** Comme `evaluate`, `null` au lieu d'une erreur (app en plein démarrage). */
export async function tryEvaluate(ctx, expression) {
  try {
    return await evaluate(ctx, expression, { timeoutMs: 4000 });
  } catch {
    return null;
  }
}

/** Des ordres à l'agent (`down`, `hold:1.2`, `activate`, `focus`…). */
export async function agentRun(ctx, commands, { timeoutMs = 60_000 } = {}) {
  const send = () => httpJson(`http://127.0.0.1:${ctx.ports.agentHttp}/run`, { method: "POST", body: commands, timeoutMs });
  let res = await send();
  // Un ordre sans effet de bord (ramener l'app, lire le focus) se renvoie une fois :
  // l'agent de l'Apple TV physique reste parfois muet le temps d'un ordre.
  if ((!res || res.status !== 200) && commands.every((c) => c === "activate" || c === "focus")) {
    await sleep(2000);
    res = await send();
  }
  if (!res || res.status !== 200) throw new BenchError(`agent : ${res?.text ?? "pas de réponse"} (ordres ${JSON.stringify(commands)})`);
  return res.json;
}

const KEYS = new Set(["up", "down", "left", "right", "select", "menu", "play", "home", "activate"]);
const HOLDS = /^(hold|holdup|holddown|holdleft|holdright):(\d+(?:\.\d+)?)$/;

/** Un geste est-il du vocabulaire ? (`check` le dit avant tout lancement.) */
export function gestureError(gesture) {
  if (typeof gesture !== "string") return "un geste est une chaîne";
  if (KEYS.has(gesture) || HOLDS.test(gesture)) return null;
  if (/^wait:\d+(\.\d+)?$/.test(gesture)) return null;
  if (/^type:.+/s.test(gesture)) return null;
  if (/^swipe:(up|down|left|right)$/.test(gesture)) return null;
  if (/^pan:-?\d+(\.\d+)?,-?\d+(\.\d+)?(,\d+)?$/.test(gesture)) return null;
  if (/^backend:[a-zA-Z]+=[\w-]+$/.test(gesture)) return null;
  return `geste inconnu : « ${gesture} »`;
}

const SWIPE = { up: "swipeUp", down: "swipeDown", left: "swipeLeft", right: "swipeRight" };

/**
 * Le glissé, par le chemin JS de RN-tvOS (`onHWKeyEvent`, `pan`) : début, des
 * pas réguliers, fin — planifiés DANS le runtime (un événement émis par
 * l'évaluation CDP elle-même passerait hors de la boucle de React).
 */
function panScript(dx, dy, ms) {
  const steps = Math.max(2, Math.round(ms / 16));
  return `(() => {
    const emit = globalThis.__navGolden.emitRemote;
    const total = ${steps}; let i = 0;
    const vx = ${(dx * 1000) / ms}, vy = ${(dy * 1000) / ms};
    setTimeout(() => emit({ eventType: "pan", body: { state: "Began", x: 0, y: 0, velocityX: 0, velocityY: 0 } }), 0);
    const timer = setInterval(() => {
      i += 1;
      const x = ${dx} * i / total, y = ${dy} * i / total;
      if (i < total) emit({ eventType: "pan", body: { state: "Changed", x, y, velocityX: vx, velocityY: vy } });
      else { clearInterval(timer); emit({ eventType: "pan", body: { state: "Ended", x, y, velocityX: vx, velocityY: vy } }); }
    }, 16);
    return total;
  })()`;
}

/** Joue un geste ; rend la durée à attendre en plus (glissé en cours). */
export async function perform(ctx, gesture) {
  if (KEYS.has(gesture) || HOLDS.test(gesture) || gesture.startsWith("type:")) {
    await agentRun(ctx, [gesture]);
    return 0;
  }
  let match;
  if ((match = gesture.match(/^wait:(\d+(?:\.\d+)?)$/))) {
    await sleep(Number(match[1]) * 1000);
    return 0;
  }
  if ((match = gesture.match(/^swipe:(\w+)$/))) {
    await evaluate(ctx, `setTimeout(() => globalThis.__navGolden.emitRemote({ eventType: "${SWIPE[match[1]]}", body: { state: "Ended" } }), 0), 1`);
    return 0;
  }
  if ((match = gesture.match(/^pan:(-?[\d.]+),(-?[\d.]+)(?:,(\d+))?$/))) {
    const ms = Number(match[3] ?? 400);
    await evaluate(ctx, panScript(Number(match[1]), Number(match[2]), ms));
    return ms + 50;
  }
  if ((match = gesture.match(/^backend:(\w+)=([\w-]+)$/))) {
    const res = await httpJson(`http://127.0.0.1:${ctx.ports.backend}/__modes?${match[1]}=${encodeURIComponent(match[2])}`);
    if (res?.status !== 200) throw new BenchError(`faux backend : mode ${match[1]} refusé`);
    return 0;
  }
  throw new BenchError(gestureError(gesture) ?? `geste non joué : ${gesture}`);
}
