// Banc lg2 (testeur) : garde UNE app de dev ouverte (coin, sans focus, profil
// jetable) pendant qu'`act.mjs` la pilote par CDP. Arrêt : SIGTERM à CE pid
// (écrit dans <état>/hold-<compte>.pid) — jamais pkill -f.
//   BANC_STATE=… BANC_PORT_BACKEND=3115 BANC_PORT_CDP=9335 BANC_PORT_MAIN=9435 node lg2/hold.mjs Knaoxtest
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, sleep } from "../lib/app.mjs";
import { STATE, SERVER, account, outDir } from "../lib/config.mjs";
import { launchApp, stopApp } from "../lib/electron.mjs";

const who = process.argv[2] ?? "Knaoxtest";
const out = outDir(`lg2-hold-${who}`);
const app = await launchApp({ home: path.join(STATE, `home-lg2-${who}`), fresh: true, log: path.join(out, "electron.log") });
const pidFile = path.join(STATE, `hold-${who}.pid`);
writeFileSync(pidFile, `${process.pid} ${app.pid}\n`);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await stopApp(app);
  rmSync(pidFile, { force: true });
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
try {
  await connectAndLogin(app.page, { server: SERVER, ...account(who) });
  await sleep(4000);
  await dismissOverlays(app.page);
  console.log(`prêt — electron ${app.pid}`);
} catch (error) {
  console.error(String(error));
}
// Sortie de l'app sans SIGTERM : on rend le slot (sinon le verrou du lot reste pris).
app.child.once("exit", () => { if (!stopping) stop(); });
setInterval(() => {}, 1 << 30);
