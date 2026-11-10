// Ce que coûte le PiP en mémoire : empreinte (phys_footprint) de l'app et de ses helpers,
// lecture dans le lecteur, puis réduite en PiP, puis PiP refermé (lecture revenue au lecteur).
// Indicatif : la machine est partagée, les chiffres bougent de quelques Mo d'une passe à l'autre.
//   PONT_CDP_PORT=9426 node bench/pip/ram.mjs <pid de Tentacle> ["Banc HDR10 Pistes"]
import { execFileSync } from "node:child_process";
import { drive, findItem, sleep } from "./pip-drive.mjs";

const root = process.argv[2];
const title = process.argv[3] ?? "Banc HDR10 Pistes";
const tree = () => [root, ...execFileSync("pgrep", ["-P", root]).toString().trim().split("\n")];
function footprint() {
  const out = { total: 0 };
  for (const pid of tree()) {
    const text = execFileSync("footprint", ["-p", pid]).toString();
    const mb = Number(/phys_footprint: ([\d.]+) MB/.exec(text)?.[1] ?? 0);
    const comm = execFileSync("ps", ["-o", "comm=", "-p", pid]).toString().trim();
    const kind = /\((\w+)\)$/.exec(comm)?.[1] ?? (pid === root ? "principal" : comm.split("/").pop());
    out[kind] = (out[kind] ?? 0) + mb;
    out.total += mb;
  }
  return out;
}
const show = (label, f) => console.log(`${label.padEnd(24)} ${Object.entries(f).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(" · ")} Mo`);

const d = await drive();
await d.playFromDetail((await findItem(title)).item.Id);
await sleep(1500);
await d.dismissModals();
await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
await sleep(4000);
const a = footprint();
show("lecture dans le lecteur", a);
let first = null;
for (let cycle = 1; cycle <= 3; cycle++) {
  await d.wake(); await sleep(250);
  await d.cdp.eval(`[...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === "Lecture en incrustation")?.click()`);
  await d.waitFor(async () => (await d.state())?.open, 6000);
  await sleep(4000);
  const b = footprint();
  show(`${cycle}. lecture en PiP`, b);
  first ??= b;
  const pip = await d.pip();
  await pip.move(100, 80);
  await pip.click("Revenir au lecteur");
  await d.waitFor(async () => !(await d.state()).open, 6000);
  await sleep(4000);
  const c = footprint();
  show(`${cycle}. PiP refermé`, c);
  console.log(`   PiP ${cycle} : +${(b.total - a.total).toFixed(0)} Mo pendant, +${(c.total - a.total).toFixed(0)} Mo après`);
  pip.close();
}
d.cdp.close();
