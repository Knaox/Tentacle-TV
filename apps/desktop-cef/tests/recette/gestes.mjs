#!/usr/bin/env node
// Recette des gestes de l'axe navigateur, rejouable : chaque cas attend le comportement
// d'Electron 43. Lancer l'app par `tests/recette/app.sh start --debug-input` (TENTACLE_DEBUG_NAVIGATEUR
// et TENTACLE_OPEN_EXTERNAL=log posés par app.sh), page du front connectée.
//   node tests/recette/gestes.mjs <port> <fichier-image> <fichier-audio> <dossier-temp>
// Sortie : une ligne par cas « OK|KO  cas — obtenu » ; code de retour = nombre de KO.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

const [port = "9425", image, audio, tmp] = process.argv.slice(2);
const log = join(process.env.HOME, ".cache/tentacle-cef/build/cef-navigateur-run.log");
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression, gesture = false) => {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: gesture });
  return r.exceptionDetails ? `exception: ${r.exceptionDetails.text}` : r.result.value;
};
const dlg = (p) => ev(`__shell.invoke('navigateur.debug.dialogs', ${JSON.stringify(p)})`);
const nat = (p) => ev(`__shell.invoke('shell.debug.native', ${JSON.stringify(p)})`);
const logTail = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
let failures = 0;
const check = (name, ok, got) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK" : "KO"}  ${name} — ${typeof got === "string" ? got : JSON.stringify(got)}`);
};

// Permissions (Electron : tout refusé sauf l'écriture du presse-papiers).
check("notifications : contrôle refusé", (await ev("navigator.permissions.query({name:'notifications'}).then(s=>s.state)")) === "denied", await ev("Notification.permission"));
check("notifications : demande refusée sans attendre", (await ev("Notification.requestPermission()", true)) === "denied", "denied");
check("presse-papiers : écriture permise", (await ev("navigator.clipboard.writeText('recette').then(()=>'ok',e=>e.message)", true)) === "ok", "ok");
check("micro : refusé", (await ev("navigator.mediaDevices.getUserMedia({audio:true}).then(()=>'ok',e=>e.name)", true)) === "NotAllowedError", "NotAllowedError");

// Fenêtres et navigation (lockNavigation).
const before = logTail().length;
await ev("window.open('https://example.org/recette-fenetre','_blank','noopener')", true);
await ev("(location.href='https://example.org/recette-nav', 1)", true);
await wait(800);
const ext = logTail().slice(before);
check("window.open → navigateur du système", ext.includes("recette-fenetre"), "journal [externe]");
check("navigation hors origine → dehors, la page reste", ext.includes("recette-nav") && (await ev("location.protocol")) === "tentacle:", await ev("location.href"));

// Boîtes JavaScript (réponses d'avance : la boîte bloque la page).
await dlg({ op: "queue", answers: [{ response: 1, afterMs: 600 }, { response: 0, afterMs: 300 }, { afterMs: 300 }] });
const js = await ev("(()=>{ const r=[confirm('Recette ?'), confirm('Recette 2 ?')]; alert('Recette'); r.push(prompt('?','x')); return r })()");
check("confirm Annuler/OK, alert, prompt → null", JSON.stringify(js) === "[false,true,null]", js);

// <input type=file> : panneau natif, fichier rendu à la page.
await dlg({ op: "queue", answers: [{ paths: [image], afterMs: 800 }] });
await ev(`(()=>{const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=()=>{window.__f=[...i.files].map(f=>f.name+':'+f.size)}; document.body.append(i); i.click(); return 1})()`, true);
await wait(1800);
const file = await ev("window.__f");
const last = (await dlg({ op: "state" })).history.at(-1);
check("<input type=file> : fichier reçu", Array.isArray(file) && file.length === 1, file);
check("<input type=file> : filtres d'Electron", last?.filters?.[0]?.name === "Image Files" && last?.filters?.[1]?.name === "All Files", last?.filters?.map((f) => f.name));

// Téléchargement : enregistré puis annulé.
const target = join(tmp, "recette-telechargement.txt");
rmSync(target, { force: true });
await dlg({ op: "queue", answers: [{ paths: [target], afterMs: 500 }, { cancel: true, afterMs: 400 }] });
const dl = (n) => ev(`(()=>{const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['${n}'])); a.download='r${n}.txt'; document.body.append(a); a.click(); a.remove(); return 1})()`, true);
await dl(1); await wait(1800); await dl(2); await wait(1500);
check("téléchargement : boîte d'enregistrement, fichier écrit", existsSync(target), target);
check("téléchargement annulé : rien d'écrit", !existsSync(join(tmp, "r2.txt")), "aucun fichier");

// Dépôts venus de l'OS (SDL_EVENT_DROP_*), et aucune navigation sur un dépôt.
await ev(`(()=>{window.__d=[]; const log=(e)=>__d.push(e.type+':'+[...e.dataTransfer.files].map(f=>f.name).join(',')); window.addEventListener('dragover',e=>e.preventDefault()); window.addEventListener('drop',e=>{e.preventDefault(); log(e)}); return 1})()`);
await ev(`__shell.invoke('navigateur.debug.drop', ${JSON.stringify({ files: [audio], x: 400, y: 300 })})`);
await wait(900);
check("fichier déposé depuis l'OS → drop avec le fichier", JSON.stringify(await ev("window.__d")).includes(audio.split("/").pop()), await ev("window.__d"));

// Glisser interne (souris SDL injectée) : source → cible.
await ev(`(()=>{const s=document.createElement('div'); s.draggable=true; s.style.cssText='position:fixed;left:200px;top:200px;width:200px;height:60px;background:#a0f;z-index:99999'; s.ondragstart=e=>{e.dataTransfer.setData('application/x-octave-track','cle-42'); e.dataTransfer.effectAllowed='copy'}; const d=document.createElement('div'); d.style.cssText='position:fixed;left:700px;top:400px;width:200px;height:100px;background:#0a6;z-index:99999'; d.ondragover=e=>{e.preventDefault(); e.dataTransfer.dropEffect='copy'}; d.ondrop=e=>{e.preventDefault(); window.__g=e.dataTransfer.getData('application/x-octave-track')}; document.body.append(s,d); return 1})()`);
for (const [kind, x, y] of [["move", 250, 230], ["down", 250, 230], ["move", 260, 236], ["move", 280, 246], ["move", 780, 440], ["move", 790, 450], ["up", 790, 450]]) {
  await nat({ type: "mouse", kind, x, y });
  await wait(180);
}
await wait(400);
check("glisser interne : la cible reçoit la donnée", (await ev("window.__g")) === "cle-42", await ev("window.__g"));

// Bulle title= après le délai de survol, retirée au clic.
await ev(`(()=>{const b=document.createElement('button'); b.title='Recette bulle'; b.style.cssText='position:fixed;left:300px;top:600px;width:60px;height:40px;z-index:99999'; document.body.append(b); return 1})()`);
await nat({ type: "mouse", kind: "move", x: 320, y: 615 });
await nat({ type: "mouse", kind: "move", x: 322, y: 616 });
await wait(1600);
const tip = await ev("__shell.invoke('navigateur.debug.tooltip')");
check("bulle title= affichée après le délai", tip.shown === "Recette bulle", tip);
await nat({ type: "mouse", kind: "down", x: 322, y: 616 });
await nat({ type: "mouse", kind: "up", x: 322, y: 616 });
await wait(300);
check("bulle retirée au clic", (await ev("__shell.invoke('navigateur.debug.tooltip')")).shown === "", "");

// Ni zoom ni plein écran HTML (Electron : aucun rôle de zoom, permission « fullscreen » refusée).
const width = await ev("innerWidth");
for (const t of ["rawKeyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type: t, key: "=", code: "Equal", modifiers: 4, windowsVirtualKeyCode: 187 });
await wait(300);
check("⌘= ne zoome pas", (await ev("innerWidth")) === width, await ev("innerWidth"));
void ev("document.documentElement.requestFullscreen().catch(()=>0)", true);
await wait(800);
check("requestFullscreen sans effet", (await ev("document.fullscreenElement")) === null, "fenêtre inchangée");

cdp.close();
process.exitCode = failures;
