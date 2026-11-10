// La marge EDR de l'écran avec la vidéo HDR10 dans la fenêtre PRINCIPALE (témoin du banc PiP).
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { drive, findItem, sleep } from "./pip-drive.mjs";
const d = await drive();
await d.playFromDetail((await findItem(process.argv[2] ?? "Banc HDR10 Pistes")).item.Id);
await sleep(1500);
await d.dismissModals();
await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
await sleep(3000);
const out = execFileSync(`${homedir()}/.cache/tentacle-cef/build/video-hdr/edr-probe/edr-probe`, ["--duration", "1", "--changes"]).toString();
console.log("fenêtre principale, HDR10 :", /max=([\d.]+)/.exec(out)?.[1], JSON.stringify(await d.surface()));
d.cdp.close();
