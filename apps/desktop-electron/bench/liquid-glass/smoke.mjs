// Passage de fumée : profil neuf, connexion Knaoxtest, accueil, une capture.
//   BANC_STATE=<état> node smoke.mjs
import path from "node:path";
import { connectAndLogin, dismissOverlays, glassDom, sleep } from "./lib/app.mjs";
import { STATE, SERVER, account, outDir } from "./lib/config.mjs";
import { launchApp, stopApp } from "./lib/electron.mjs";
import { captureWindow, mainWindow } from "./lib/macos.mjs";

const out = outDir("fumee");
const app = await launchApp({ home: path.join(STATE, "home-fumee"), fresh: true, log: path.join(out, "electron.log") });
try {
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(4000);
  await dismissOverlays(app.page);
  await sleep(1500);
  console.log(JSON.stringify(await glassDom(app.page), null, 1));
  const win = mainWindow(STATE, app.pid);
  console.log("fenêtre", win);
  if (win) console.log(captureWindow(win.id, path.join(out, "accueil.png")));
} catch (error) {
  console.error(String(error));
  console.error(await app.page.evaluate("return location.href + ' | ' + document.body.innerText.slice(0, 600);").catch(String));
  const win = mainWindow(STATE, app.pid);
  if (win) captureWindow(win.id, path.join(out, "echec.png"));
} finally {
  await stopApp(app);
}
