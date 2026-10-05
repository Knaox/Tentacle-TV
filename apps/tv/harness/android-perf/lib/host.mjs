// Le Mac qui fait tourner l'émulateur : le placer sur des cœurs constants.
import { execFileSync } from "node:child_process";

/**
 * L'émulateur sur les cœurs ÉCONOMES du Mac pendant ce qui se MESURE
 * (`taskpolicy -b` : la priorité d'arrière-plan de Darwin, que l'Apple M4
 * n'exécute que sur ses cœurs d'efficacité) ; l'installation, la compilation
 * du profil et la mise en place restent sur les cœurs de performance
 * (`taskpolicy -B`), sans quoi une passe durerait deux fois plus. Deux
 * raisons :
 *
 * - la CONSTANCE : l'Apple M4 n'a que quatre cœurs de performance ; dès que
 *   d'autres sessions compilent, l'émulateur passe d'une famille de cœurs à
 *   l'autre au gré de l'ordonnanceur, et le même geste coûte deux à trois
 *   fois plus d'une passe à l'autre ;
 * - la PROXIMITÉ de la Shield : un cœur économe du M4 reste plus rapide qu'un
 *   Cortex-A57, mais l'écart tombe d'environ huit à environ trois.
 *
 * `enabled` faux : rien ne bouge.
 */
export function createHostPolicy(enabled, log = () => {}) {
  if (!enabled) return { slow: false, measuring: async (fn) => fn(), restore: () => {} };
  let pids = [];
  try {
    // Le NOM du processus, jamais sa ligne de commande : un shell qui contient
    // « qemu-system » (un pgrep, un script) y passerait aussi.
    pids = execFileSync("pgrep", ["-x", "qemu-system-(aarch64|x86_64)"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    // pgrep sort en erreur quand rien ne correspond.
  }
  if (pids.length === 0) throw new Error("--slow : aucun processus qemu-system (l'émulateur tourne-t-il sur ce Mac ?)");
  log(`mesures sur les cœurs économes (taskpolicy -b, émulateur ${pids.join(", ")})`);
  const apply = (option) => {
    for (const pid of pids) {
      try {
        execFileSync("taskpolicy", [option, "-p", pid]);
      } catch {
        // L'émulateur a pu s'éteindre entre-temps.
      }
    }
  };
  return {
    slow: true,
    async measuring(fn) {
      apply("-b");
      try {
        return await fn();
      } finally {
        apply("-B");
      }
    },
    restore: () => apply("-B"),
  };
}
