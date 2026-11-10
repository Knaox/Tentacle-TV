#!/usr/bin/env node
// Preuve du PiP sous Linux (Wayland : la sous-surface de mpv PRÊTÉE à la fenêtre PiP), sur l'app
// du conteneur (bench/linux/run.sh up sway), par le front : le film du banc, « Lecture en
// incrustation », la vidéo vue DANS la fenêtre PiP (pixels de l'écran), « Revenir au lecteur »,
// une seconde réduction, « Fermer la vidéo ».
//   node bench/linux/prove-pip.mjs [capture.png]
// X11 : pip_* non déclarées (comme Electron) — la preuve le dit et s'arrête.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.PONT_CDP_PORT ??= "9427";
const here = dirname(fileURLToPath(import.meta.url));
const { drive, findItem, sleep } = await import(join(here, "../pip/pip-drive.mjs"));
const container = process.env.BANC_LINUX_NAME ?? "tentacle-cef-linux";
const show = (label, v) => console.log(`${label} : ${typeof v === "string" ? v : JSON.stringify(v)}`);
const L = { reduce: "Lecture en incrustation", expand: "Revenir au lecteur", close: "Fermer la vidéo" };

// Dans le conteneur : la fenêtre PiP (flottante sous sway), posée en (x, y), et des pixels de
// l'écran — le centre de sa vidéo et un point de sa marge.
const inside = (script) => {
  const env = "export XDG_RUNTIME_DIR=/tmp/xdg WAYLAND_DISPLAY=$(cat /tmp/banc/wayland); SWAYSOCK=$(ls /tmp/xdg/sway-ipc.* | head -1); export SWAYSOCK;";
  const r = spawnSync("docker", ["exec", container, "bash", "-c", env + script], { encoding: "utf8" });
  return (r.stdout + r.stderr).trim();
};
const floating = () => {
  const out = inside(`swaymsg -t get_tree | python3 -c "import json,sys
def w(n):
  if n.get('type') == 'floating_con': print(json.dumps([n['id'], n['rect']]))
  [w(c) for c in n.get('nodes', []) + n.get('floating_nodes', [])]
w(json.load(sys.stdin))"`);
  return out ? JSON.parse(out.split("\n")[0]) : null;
};
const pixels = (points) =>
  inside(`grim /tmp/banc/s.png && for p in ${points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ")}; do
    magick /tmp/banc/s.png -format "$p=%[pixel:p{$p}] " info:; done`);

const d = await drive();
const { cdp } = d;
// Le clic part au tour suivant : un bouton qui ferme la page du PiP n'attend pas sa réponse.
const click = (page, label) =>
  page.eval(`(() => { const b = [...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === ${JSON.stringify(label)});
    if (b) setTimeout(() => b.click(), 50); return !!b; })()`);
const advancing = async () => {
  const a = await d.prop("time-pos");
  await sleep(1200);
  const b = await d.prop("time-pos");
  return `${a?.toFixed(2)} → ${b?.toFixed(2)} s${b > a ? "" : " (À L'ARRÊT)"}`;
};
const reduce = async () => {
  await d.wake();
  await sleep(250);
  await click(cdp, L.reduce);
  await d.waitFor(async () => (await d.state())?.open, 6000);
  await sleep(1500);
};

try {
  const caps = await cdp.eval("window.tentacle.capabilities.filter((c) => c.startsWith('pip_'))");
  show("commandes pip_*", caps);
  if (!caps.length) {
    show("PiP", "non déclaré sur ce montage (X11 : comme Electron)");
    process.exit(0);
  }
  await d.playFromDetail((await findItem("Banc Pistes SDR")).item.Id);
  await sleep(1500);
  await d.dismissModals();
  await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
  // Le film du banc dure 2 min ; la page le ramène à 5 s avant la fin (la preuve en prend plus).
  await cdp.eval(`(() => { clearInterval(window.__boucle); window.__boucle = setInterval(async () => {
    const t = await window.tentacle.invoke("mpv_get_property", { name: "time-pos", format: "double" }).catch(() => 0);
    if (t > 90) window.tentacle.invoke("mpv_command", { name: "seek", args: ["5", "absolute"] }).catch(() => {}); }, 5000); return true; })()`);
  show("lecteur, avant", await d.layers());

  await reduce();
  const s = await d.state();
  show("PiP ouvert", { open: s.open, videoLent: s.videoLent, bounds: s.bounds, mode: s.mode });
  show("pile du PiP", s.layers);
  show("pile principale", await d.layers());
  show("lecture pendant le PiP", await advancing());
  const win = floating();
  if (win) {
    inside(`swaymsg "[con_id=${win[0]}] move position 80 600" >/dev/null`);
    await sleep(800);
    const r = floating()[1];
    // Centre de la vidéo (le cadre : à `inset` des bords) et marge (ombre seule, transparente).
    show("pixels (centre de la vidéo, marge)", pixels([[r.x + r.width / 2, r.y + r.height / 2], [r.x + 3, r.y + r.height / 2]]));
    if (process.argv[2]) {
      inside("grim /tmp/banc/pip.png");
      spawnSync("docker", ["cp", `${container}:/tmp/banc/pip.png`, process.argv[2]]);
      show("capture", process.argv[2]);
    }
  }

  const pip = await d.pip();
  show("« Revenir au lecteur »", await click(pip, L.expand));
  await d.waitFor(async () => !(await d.state())?.open, 6000);
  await sleep(800);
  show("après le retour", { open: (await d.state()).open, videoLent: (await d.state()).videoLent, page: await d.path() });
  show("pile principale", await d.layers());
  show("lecture après le retour", await advancing());

  await reduce();
  show("seconde réduction", (await d.state()).layers);
  const pip2 = await d.pip();
  show("« Fermer la vidéo »", await click(pip2, L.close));
  await d.waitFor(async () => !(await d.state())?.open, 6000);
  await sleep(800);
  show("après la fermeture", { open: (await d.state()).open, videoLent: (await d.state()).videoLent, page: await d.path() });
  show("pile principale", await d.layers());
} finally {
  await cdp.eval("clearInterval(window.__boucle)").catch(() => {});
  process.exit(process.exitCode ?? 0);
}
