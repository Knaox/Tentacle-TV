// Quitter PENDANT le PiP (`pipQuit.ts`) : une lecture réduite, puis la fermeture de l'app.
// La suite (le processus part, rien ne reste) est vérifiée par quit.sh.
//   PONT_CDP_PORT=9426 node bench/pip/quit.mjs ["Banc HDR10 Pistes"]
import { drive, findItem, sleep } from "./pip-drive.mjs";

const d = await drive();
await d.playFromDetail((await findItem(process.argv[2] ?? "Banc HDR10 Pistes")).item.Id);
await sleep(1500);
await d.dismissModals();
await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
await d.wake(); await sleep(250);
await d.cdp.eval(`[...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === "Lecture en incrustation")?.click()`);
const open = await d.waitFor(async () => (await d.state())?.open, 6000);
d.check("PiP ouvert avant de quitter", open, JSON.stringify((await d.state())?.bounds));
await sleep(800);
// Comme Cmd+Q : la boucle SDL ferme le navigateur principal (DoClose → le PiP part d'abord).
await d.cdp.eval("setTimeout(() => __shell.invoke('shell.quit'), 0), true");
d.finish();
