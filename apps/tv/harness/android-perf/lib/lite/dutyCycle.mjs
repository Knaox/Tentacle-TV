#!/usr/bin/env node
// Le cycle de freinage d'un émulateur (`throttle.mjs`, `duty:N`) : qemu
// suspendu puis relâché toutes les 20 ms, N % du temps en marche. Un
// processus à part : la boucle ne dépend pas de ce que fait le banc. Il
// relâche toujours qemu en sortant (SIGTERM, SIGINT, fin du parent).
//
//   node dutyCycle.mjs <pid de qemu> <pourcentage en marche>
const pid = Number(process.argv[2]);
const percent = Number(process.argv[3]);
const PERIOD_MS = 20;
if (!(pid > 0) || !(percent > 0 && percent < 100)) {
  console.error("usage : dutyCycle.mjs <pid> <1-99>");
  process.exit(2);
}
const runMs = (PERIOD_MS * percent) / 100;
let stopped = false;
const signal = (name) => {
  try {
    process.kill(pid, name);
    return true;
  } catch {
    return false;
  }
};
const release = () => {
  signal("SIGCONT");
  process.exit(0);
};
process.on("SIGTERM", release);
process.on("SIGINT", release);
process.on("disconnect", release);
// Le parent mort, on relâche : jamais un émulateur laissé suspendu.
const parent = process.ppid;
const tick = () => {
  if (!signal(stopped ? "SIGCONT" : "SIGSTOP")) process.exit(0);
  stopped = !stopped;
  try {
    process.kill(parent, 0);
  } catch {
    release();
  }
  setTimeout(tick, stopped ? PERIOD_MS - runMs : runMs);
};
setTimeout(tick, runMs);
