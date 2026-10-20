/**
 * Banc Watch Together — point d'entrée.
 *
 *   bench:wt up                 monte Jellyfin + backend + web (≈ 3 min la première fois)
 *   bench:wt run [scénario…]    joue les scénarios (tous par défaut), rapport dans .runs/wt/
 *   bench:wt list               liste les scénarios
 *   bench:wt restart-backend    relance le seul backend (après une fusion)
 *   bench:wt down [--purge]     arrête (--purge : conteneur et volumes supprimés)
 *
 * Jamais lancé par `pnpm test`.
 */

import { spawn } from "node:child_process";
import { down, restartBackend, up } from "./env";
import { runScenarios, SCENARIOS } from "./scenarios";

/**
 * Pas de veille du Mac pendant un passage : une veille profonde (capot fermé,
 * vu le 20/10 de 04:56 à 05:14) gèle tout le banc et fausse chaque mesure.
 * `caffeinate -s` tient tant que ce processus vit (`-w`).
 */
function keepAwake(): void {
  if (process.platform !== "darwin") return;
  spawn("caffeinate", ["-s", "-w", String(process.pid)], { detached: true, stdio: "ignore" }).unref();
}

async function main(): Promise<void> {
  const [cmd = "run", ...rest] = process.argv.slice(2);
  if (cmd === "run" || cmd === "up") keepAwake();
  if (cmd === "up") await up();
  else if (cmd === "down") down({ purge: rest.includes("--purge") });
  else if (cmd === "restart-backend") await restartBackend();
  else if (cmd === "list") for (const s of SCENARIOS) console.log(`${s.id.padEnd(22)} ${s.title}`);
  else if (cmd === "run") process.exitCode = (await runScenarios(rest)) ? 0 : 1;
  else throw new Error(`commande inconnue : ${cmd}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
