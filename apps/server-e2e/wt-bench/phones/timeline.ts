/**
 * Chronologie de plusieurs téléphones : toutes les 200 ms, la sonde du lecteur
 * (`__wtBench` : position, pause, route) de chaque appareil, en JSON par ligne
 * sur l'heure murale du Mac. Sert à mesurer « clic Rejoindre → pause de
 * l'autre », un recul de position, un départ.
 *
 *   tsx wt-bench/phones/timeline.ts <secondes> <appareil> [appareil…] [--do <s>:<appareil>:<commande>:<argument>]… > fichier.jsonl
 *
 * Chaque ligne : { at, dev, pos, paused, route } (pos null : pas de lecteur).
 * `--do` joue un geste de `drive.ts` (press, press-exact, press-label, nav,
 * eval) à <s> secondes, sur la MÊME session Hermes : Metro n'accepte qu'un
 * client CDP par appareil (un second reste sans réponse). Ligne { at, dev, did }.
 */

import { HermesSession } from "../clients/hermes";
import { labelsExpr, navExpr, pressExpr, textsExpr } from "./drive";

const METRO_PORT = Number(process.env.WT_METRO_PORT ?? 8731);

const PROBE = "var b = globalThis.__wtBench; var p = b && b.sample ? b.sample() : null;"
  + " return p ? { pos: p.raw && p.raw.pos !== null ? p.raw.pos : p.pos, paused: p.paused, route: p.route, ready: p.ready } : { pos: null };";

interface Step { atS: number; dev: string; cmd: string; arg: string; done?: boolean }

function exprOf(step: Step): string {
  switch (step.cmd) {
    case "press": return pressExpr({ text: step.arg });
    case "press-exact": return pressExpr({ text: step.arg, exact: true });
    case "press-label": return pressExpr({ label: step.arg });
    case "nav": return navExpr(step.arg);
    case "texts": return textsExpr();
    case "labels": return labelsExpr();
    default: return step.arg;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const steps: Step[] = [];
  const devices: string[] = [];
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === "--do") {
      const [atS, dev, cmd, ...rest] = args[++i].split(":");
      steps.push({ atS: Number(atS), dev, cmd, arg: rest.join(":") });
    } else devices.push(args[i]);
  }
  const sessions = new Map<string, HermesSession>();
  const start = Date.now();
  const end = start + Number(args[0]) * 1000;
  while (Date.now() < end) {
    for (const step of steps) {
      if (step.done || Date.now() - start < step.atS * 1000) continue;
      step.done = true;
      const h = sessions.get(step.dev) ?? await HermesSession.connect(METRO_PORT, step.dev);
      sessions.set(step.dev, h);
      const at = Date.now();
      const did = await h.eval<unknown>(exprOf(step)).catch((err: unknown) => String(err));
      console.log(JSON.stringify({ at, dev: step.dev, did: `${step.cmd} ${step.arg} → ${JSON.stringify(did).slice(-1500)}` }));
    }
    await Promise.all(devices.map(async (dev) => {
      try {
        let h = sessions.get(dev);
        if (!h || h.closed) {
          h = await HermesSession.connect(METRO_PORT, dev);
          sessions.set(dev, h);
        }
        const s = await h.eval<Record<string, unknown>>(PROBE);
        console.log(JSON.stringify({ at: Date.now(), dev, ...s }));
      } catch (err) {
        console.log(JSON.stringify({ at: Date.now(), dev, error: String(err).slice(0, 120) }));
      }
    }));
    await new Promise((ok) => setTimeout(ok, 200));
  }
  for (const h of sessions.values()) h.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
