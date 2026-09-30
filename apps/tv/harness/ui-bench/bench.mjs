#!/usr/bin/env node
// Le banc UI en ligne de commande : lancer, piloter, capturer — sans
// télécommande ni navigateur. Voir README.md pour le déroulé complet.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSimulator, foreground, launchApp, screenshot } from "./tools/simulator.mjs";
import { buildPlanches } from "./tools/planche.mjs";
import { captureSnapshot } from "./tools/captureSnapshot.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const BENCH_PORT = Number(process.env.BENCH_PORT ?? 8093);
const METRO_PORT = Number(process.env.METRO_PORT ?? 8094);
const RELAY = `http://127.0.0.1:${BENCH_PORT}`;

async function call(pathname, init) {
  const res = await fetch(`${RELAY}${pathname}`, init).catch(() => null);
  if (!res) throw new Error(`relais injoignable sur ${BENCH_PORT} — lancer d'abord « bench.mjs up »`);
  return res.json();
}

/** Les trois verres du banc : natif là où le système l'offre (`on`), simulé
 *  même là (`sim` — le repli des tvOS < 26), enrichi (`off`). */
const GLASS = {
  on: { patch: { glass: true, nativeGlass: true }, label: "verre" },
  sim: { patch: { glass: true, nativeGlass: false }, label: "verre simulé" },
  off: { patch: { glass: false, nativeGlass: true }, label: "enrichi" },
};
const glassOf = (state) => (!state.glass ? "off" : state.nativeGlass === false ? "sim" : "on");

const post = (pathname, body) =>
  call(pathname, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Pose un état et attend que le banc l'affiche (images comprises). Sans
 *  réponse, l'app a pu passer derrière l'accueil de tvOS : on la ramène au
 *  premier plan et on attend encore une fois. */
async function apply(patch) {
  const state = await post("/bench/control", patch);
  let ready = await call(`/bench/ready?rev=${state.rev}&timeout=15000`);
  if (ready.readyRev < state.rev) {
    foreground();
    ready = await call(`/bench/ready?rev=${state.rev}&timeout=30000`);
  }
  if (ready.readyRev < state.rev) throw new Error(`le banc n'a pas affiché la révision ${state.rev} (app lancée ?)`);
  return state;
}

async function scenes(prefix = "") {
  const list = await call("/bench/scenes");
  if (!list.length) throw new Error("aucune scène publiée — l'app du banc tourne-t-elle ?");
  return list.filter((scene) => scene.id.startsWith(prefix));
}

function up() {
  const children = [
    ["metro", spawn("npx", ["react-native", "start", "--port", String(METRO_PORT)], { cwd: APP_DIR, env: process.env })],
    ["relais", spawn(process.execPath, [path.join(HERE, "relay.mjs")], { env: { ...process.env, BENCH_PORT: String(BENCH_PORT), METRO_PORT: String(METRO_PORT) } })],
  ];
  for (const [name, child] of children) {
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        for (const line of String(chunk).split("\n")) if (line.trim()) console.log(name === "metro" ? `[metro] ${line}` : line);
      });
    }
    child.on("exit", (code) => console.log(`[${name}] terminé (${code})`));
  }
  const stop = () => {
    for (const [, child] of children) child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

/** Toutes les scènes d'un préfixe, chacune dans chaque variante demandée,
 *  capturées puis assemblées en planches. */
async function planche(args) {
  const prefix = args.find((a) => !a.startsWith("--")) ?? "";
  const withFocus = args.includes("--focus");
  const langs = (args.find((a) => a.startsWith("--lang="))?.slice(7) ?? "").split(",").filter(Boolean);
  const glasses = (args.find((a) => a.startsWith("--glass="))?.slice(8) ?? "").split(",").filter(Boolean);
  const list = await scenes(prefix);
  // Juste après un `launch`, le catalogue peut arriver vide : le dire, plutôt
  // que de rendre un dossier sans planche en silence.
  if (list.length === 0) {
    console.error(`aucune scène ne commence par « ${prefix} » — l'app vient-elle d'être relancée ? (bench.mjs list)`);
    process.exit(1);
  }
  const initial = await call("/bench/state");
  // Heure locale : c'est elle qu'on lit dans le nom du dossier.
  const stamp = new Date().toLocaleString("sv-SE").replace(/[: ]/g, "-");
  const dir = path.join(OUT, `${stamp}${prefix ? `-${prefix.replace(/[^a-z0-9]+/gi, "-")}` : ""}`);
  fs.mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const lang of langs.length ? langs : [initial.lang]) {
    for (const glass of glasses.length ? glasses : [glassOf(initial)]) {
      if (!GLASS[glass]) throw new Error(`verre inconnu : ${glass} (on, sim, off)`);
      for (const scene of list) {
        // Sans --focus : le premier élément de la scène, figé — sinon tvOS
        // focalise le premier focalisable venu (souvent la loupe de la navigation).
        const focusKeys = withFocus && scene.focusKeys.length ? scene.focusKeys : [scene.focusKeys[0] ?? null];
        for (const focus of focusKeys) {
          await apply({ scene: scene.id, focus, lang, ...GLASS[glass].patch });
          const variant = [langs.length > 1 && lang, glasses.length > 1 && GLASS[glass].label, focus && `focus ${focus}`].filter(Boolean).join(" · ");
          const file = path.join(dir, `${String(shots.length).padStart(3, "0")}-${scene.id.replace(/\//g, "_")}${focus ? `__${focus.replace(/[^a-z0-9]+/gi, "-")}` : ""}.png`);
          screenshot(file);
          shots.push({ file, label: `${scene.group} · ${scene.label}${variant ? ` · ${variant}` : ""}` });
          console.log(`capturé ${path.basename(file)}`);
        }
      }
    }
  }
  await apply({ scene: initial.scene, focus: initial.focus, lang: initial.lang, ...GLASS[glassOf(initial)].patch });
  const sheets = buildPlanches(shots, dir, prefix || "toutes les scènes");
  for (const sheet of sheets) console.log(`planche ${sheet}`);
}

const [command = "help", ...args] = process.argv.slice(2);

const commands = {
  up,
  sim: () => {
    const udid = ensureSimulator(BENCH_PORT);
    launchApp(udid);
  },
  launch: () => launchApp(ensureSimulator(BENCH_PORT, { quiet: true })),
  list: async () => {
    for (const scene of await scenes(args[0])) console.log(`${scene.id.padEnd(36)} ${scene.group} · ${scene.label}${scene.focusKeys.length ? ` (${scene.focusKeys.length} focus)` : ""}`);
  },
  scene: () => apply({ scene: args[0], focus: null }),
  menu: () => apply({ scene: null, focus: null }),
  next: async () => step(1),
  prev: async () => step(-1),
  focus: () => apply({ focus: !args[0] || args[0] === "off" ? null : args[0] }),
  glass: () => {
    const mode = GLASS[args[0] ?? "on"];
    if (!mode) throw new Error(`verre inconnu : ${args[0]} (on, sim, off)`);
    return apply(mode.patch);
  },
  lang: () => apply({ lang: args[0] === "en" ? "en" : "fr" }),
  shot: async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `${args[0] ?? `capture-${Date.now()}`}.png`);
    screenshot(file);
    console.log(file);
  },
  planche: () => planche(args),
  snapshot: () => captureSnapshot(path.join(HERE, "snapshot")),
  help: () => console.log(fs.readFileSync(path.join(HERE, "README.md"), "utf8").split("\n## ")[1] ?? ""),
};

async function step(delta) {
  const list = await scenes();
  const state = await call("/bench/state");
  const index = list.findIndex((scene) => scene.id === state.scene);
  const next = list[(index + delta + list.length) % list.length];
  await apply({ scene: next.id, focus: null });
  console.log(`${next.id} — ${next.group} · ${next.label}`);
}

const run = commands[command];
if (!run) {
  console.error(`commande inconnue : ${command}`);
  process.exit(1);
}
Promise.resolve(run()).catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
