// Ce que tout passage du banc partage : l'instantané du faux backend
// nav-golden, le faux backend lui-même, et l'injecteur de touches compilé
// (`keys/Keys.java`). Utilisé par `bench.mjs` et le banc Lite (`lite.mjs`).
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "./device.mjs";

const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE = path.join(os.homedir(), "Library/Caches/tentacle-android-perf");
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");

export function latestSnapshot() {
  if (process.env.SNAPSHOT_DIR) return process.env.SNAPSHOT_DIR;
  const root = path.join(os.homedir(), "Library/Caches/tentacle-nav-golden/snapshots");
  const dirs = fs.readdirSync(root).map((name) => path.join(root, name)).filter((dir) => fs.existsSync(path.join(dir, "snapshot.json")));
  if (!dirs.length) throw new Error(`aucun instantané nav-golden dans ${root}`);
  return dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

/** L'injecteur de touches (`keys/Keys.java`), compilé au besoin — un dossier
 *  par EMPREINTE de la source : deux sessions aux versions différentes du
 *  banc ne se prennent jamais leur injecteur. */
export function keysDex() {
  const source = path.join(HERE, "keys/Keys.java");
  const hash = crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex").slice(0, 12);
  const out = path.join(CACHE, "keys", hash);
  const dex = path.join(out, "classes.dex");
  if (fs.existsSync(dex)) return dex;
  fs.mkdirSync(out, { recursive: true });
  const platforms = fs.readdirSync(path.join(SDK, "platforms")).sort();
  const jar = path.join(SDK, "platforms", platforms[platforms.length - 1], "android.jar");
  const tools = fs.readdirSync(path.join(SDK, "build-tools")).sort();
  execFileSync("javac", ["-source", "1.8", "-target", "1.8", "-cp", jar, "-d", out, source], { stdio: "ignore" });
  execFileSync(path.join(SDK, "build-tools", tools[tools.length - 1], "d8"), ["--output", out, "--lib", jar, path.join(out, "Keys.class")]);
  return dex;
}

export async function startBackend(backendPort) {
  const log = fs.openSync(path.join(CACHE, `backend-${backendPort}.log`), "w");
  const child = spawn(process.execPath, [path.join(HERE, "../nav-golden/server/fakeServer.mjs")], {
    env: { ...process.env, PORT: String(backendPort), SNAPSHOT_DIR: latestSnapshot() },
    stdio: ["ignore", log, log],
  });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      execFileSync("curl", ["-s", "-X", "POST", `http://127.0.0.1:${backendPort}/__fixtures`, "-d", '{"sets":["base/vigie-off"]}'], { stdio: "ignore" });
      return child;
    } catch {
      // pas encore à l'écoute
    }
  }
  child.kill();
  throw new Error(`le faux backend ne répond pas sur ${backendPort} — ${path.join(CACHE, `backend-${backendPort}.log`)}`);
}
