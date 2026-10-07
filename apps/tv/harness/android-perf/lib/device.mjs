// L'appareil du banc, par adb : installation, session du faux backend, mode
// de mesure, touches à temps précis (`keys/Keys.java`), journal `[perf-json]`
// et temps processeur de chaque fil de l'app.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ForegroundError, assertAllowed, assertForeground, splitAtChecks } from "./keyGuard.mjs";

/** L'app mesurée : TOUJOURS l'app de MESURE (`com.tentacletv.mobile.perf`,
 *  construite par `-PtentaclePerfApp=1`, installée à côté de la vraie), à
 *  l'émulateur comme sur un appareil réel. Le banc refuse de jouer sur
 *  `com.tentacletv.mobile`, l'app de l'utilisateur (`keyGuard.mjs`). */
export const PACKAGE = process.env.PERF_PACKAGE ?? "com.tentacletv.mobile.perf";
const REAL_PACKAGE = "com.tentacletv.mobile";
const ACTIVITY = `${PACKAGE}/com.tentacletv.MainActivity`;
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");
const KEYS_DEX = "/data/local/tmp/perf-keys.dex";

export const KEY = { up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4, playPause: 85, fastForward: 90 };

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rétablit un appareil en adb réseau : un « offline » reste offline tant
 *  qu'on ne le déconnecte pas ; on attend qu'il se redise « device » (30 s au
 *  plus). Aucune touche. */
/** Les `adb reverse` posés par appareil : une reconnexion les perd (ils
 *  vivent avec la connexion) — sans eux, l'app ne joint plus le faux backend. */
const REVERSES = new Map();

export function rememberReverse(serial, port) {
  if (!REVERSES.has(serial)) REVERSES.set(serial, new Set());
  REVERSES.get(serial).add(port);
}

export function reconnectNetwork(serial) {
  const quiet = { stdio: "ignore", timeout: 20_000 };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      execFileSync(ADB, ["disconnect", serial], quiet);
    } catch {
      // déjà déconnecté
    }
    try {
      execFileSync(ADB, ["connect", serial], quiet);
      const state = execFileSync(ADB, ["-s", serial, "get-state"], { encoding: "utf8", timeout: 10_000 }).trim();
      if (state === "device") {
        for (const port of REVERSES.get(serial) ?? []) execFileSync(ADB, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`], quiet);
        return true;
      }
    } catch {
      // pas encore revenu
    }
    execFileSync("sleep", ["5"]);
  }
  return false;
}

export function createDevice(serial = process.env.ANDROID_SERIAL ?? "emulator-5584") {
  const run = (args, options = {}) => execFileSync(ADB, ["-s", serial, ...args], { encoding: "utf8", maxBuffer: 256 << 20, ...options });
  /** Un appareil en adb RÉSEAU (la Shield) se déconnecte de temps à autre
   *  (relance du serveur adb par une autre session, Wi-Fi) : rétabli, et la
   *  commande rejouée UNE fois — jamais celle de l'injecteur de touches, qu'on
   *  ne rejoue pas à l'aveugle. */
  const adb = (args, options = {}) => {
    try {
      return run(args, options);
    } catch (error) {
      const text = `${error.stderr ?? ""}${error.message ?? ""}`;
      const lost = /offline|not found|device '.*' not found|closed|no devices/.test(text);
      if (!serial.includes(":") || !lost || args.join(" ").includes("app_process")) throw error;
      reconnectNetwork(serial);
      return run(args, options);
    }
  };
  const shell = (command, options) => adb(["shell", command], options);
  /** Ce qui EFFACE ou remplace (installation, `pm clear`, session écrite) ne
   *  vise que l'app de mesure : l'app et le jumelage de l'utilisateur ne se
   *  touchent jamais, émulateur compris. */
  const assertDisposable = () => {
    if (PACKAGE === REAL_PACKAGE) {
      throw new Error(`le banc n'écrit que dans l'app de mesure (PERF_PACKAGE=${REAL_PACKAGE}.perf), jamais dans ${REAL_PACKAGE}`);
    }
  };

  return {
    serial,
    adb,
    shell,

    describe() {
      const prop = (name) => shell(`getprop ${name}`).trim();
      return `${prop("ro.product.model")} · Android ${prop("ro.build.version.release")} (API ${prop("ro.build.version.sdk")}) · ${prop("ro.hardware.egl")}`;
    },

    install(apk) {
      assertDisposable();
      const out = adb(["install", "-r", "-d", apk], { timeout: 300_000 });
      if (!out.includes("Success")) throw new Error(`installation refusée : ${out}`);
    },

    /**
     * La session du faux backend, écrite dans la base d'AsyncStorage de l'app
     * (`RKStorage`, `user_version` 1 — sinon l'app l'efface). `run-as` exige une
     * APK DEBUGGABLE : on l'installe, on écrit, puis l'APK mesurée la remplace
     * sans effacer ses données (même clé de signature).
     */
    async writeSession({ debugApk, port }) {
      assertDisposable();
      this.install(debugApk);
      shell(`am force-stop ${PACKAGE}`);
      shell(`pm clear ${PACKAGE}`);
      const { DatabaseSync } = await import("node:sqlite");
      const file = path.join(os.tmpdir(), `android-perf-rk-${process.pid}.db`);
      fs.rmSync(file, { force: true });
      const db = new DatabaseSync(file);
      db.exec("CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      db.exec("PRAGMA user_version = 1");
      const insert = db.prepare("INSERT INTO catalystLocalStorage (key, value) VALUES (?, ?)");
      const entries = {
        tentacle_server_url: `http://localhost:${port}`,
        tentacle_token: "banc",
        tentacle_user: JSON.stringify({ Id: "banc-user", Name: "Knaoxtest" }),
        tentacle_language: "fr",
      };
      for (const [key, value] of Object.entries(entries)) insert.run(key, value);
      db.close();
      const remote = "/data/local/tmp/android-perf-rk.db";
      adb(["push", file, remote]);
      fs.rmSync(file, { force: true });
      shell(`run-as ${PACKAGE} mkdir -p databases`);
      shell(`cat ${remote} | run-as ${PACKAGE} sh -c 'cat > databases/RKStorage'`);
      shell(`rm -f ${remote}`);
      adb(["reverse", `tcp:${port}`, `tcp:${port}`]);
      rememberReverse(serial, port);
    },

    /** Le code compilé d'avance par le profil de l'APK (Baseline Profile),
     *  comme après une installation par le Play Store — les deux APK d'une
     *  comparaison partent ainsi du même état. Le profil s'écrit au premier
     *  lancement (profileinstaller). */
    compileProfile() {
      shell(`cmd package compile -m speed-profile -f ${PACKAGE}`, { timeout: 300_000 });
    },

    setPerf(on) {
      shell(`setprop debug.tentacle.perf ${on ? 1 : 0}`);
    },

    pushKeys(dex) {
      adb(["push", dex, KEYS_DEX]);
    },

    forceStop() {
      shell(`am force-stop ${PACKAGE}`);
    },

    /** Lancement à froid ; rend le « TotalTime » d'`am start -W` (première image de l'activité). */
    launch() {
      const out = shell(`am start -W -n ${ACTIVITY}`);
      return Number(out.match(/TotalTime:\s*(\d+)/)?.[1] ?? NaN);
    },

    pid() {
      return shell(`pidof ${PACKAGE}`).trim().split(/\s+/)[0] || null;
    },

    /** L'app de mesure au premier plan, ou une `ForegroundError` (`keyGuard.mjs`). */
    assertForeground() {
      assertForeground(PACKAGE, shell("dumpsys activity activities", { timeout: 30_000 }));
    },

    /**
     * Une séquence de touches (`Keys.java`) : `tap:22`, `tap:22x6@500`,
     * `hold:20:3000`, `wait:800` — GARDÉE (`keyGuard.mjs`) : touches système
     * refusées, séquence coupée à chaque OK et Retour, premier plan vérifié
     * avant chaque tronçon par le banc et avant chaque appui par l'injecteur.
     * Au moindre doute : `ForegroundError`, et plus aucune touche.
     */
    keys(...steps) {
      if (steps.length === 0) return;
      assertAllowed(PACKAGE, steps);
      for (const chunk of splitAtChecks(steps)) {
        this.assertForeground();
        try {
          const trace = process.env.PERF_KEYS_TRACE ? "KEYS_TRACE=1 " : "";
          const out = shell(`${trace}CLASSPATH=${KEYS_DEX} app_process /system/bin Keys expect=${PACKAGE} ${chunk.join(" ")}`, { timeout: 120_000 });
          if (trace) process.stdout.write(out);
        } catch (error) {
          const out = String(error.stdout ?? "");
          if (process.env.PERF_KEYS_TRACE) process.stdout.write(out);
          if (error.status === 3 || error.status === 4 || /ARRÊT/.test(out)) throw new ForegroundError(`injecteur : ${out.trim()}`);
          throw error;
        }
      }
    },

    /** Le décompte d'Android pour TOUTES les fenêtres du processus (une Modal
     *  est une fenêtre à part, que FrameMetrics de l'activité ne voit pas). */
    gfxReset() {
      shell(`dumpsys gfxinfo ${PACKAGE} reset`);
    },

    gfxStats() {
      const text = shell(`dumpsys gfxinfo ${PACKAGE}`);
      const num = (re) => Number(text.match(re)?.[1] ?? NaN);
      return {
        frames: num(/Total frames rendered: (\d+)/),
        janky: num(/Janky frames: (\d+)/),
        p90: num(/90th percentile: (\d+)ms/),
        p99: num(/99th percentile: (\d+)ms/),
      };
    },

    clearLog() {
      adb(["logcat", "-c"]);
    },

    /** Les lignes `[perf-json]` du journal depuis le dernier `clearLog`. */
    perfRecords() {
      const out = adb(["logcat", "-d", "-s", "TentaclePerf:I"]);
      return out
        .split("\n")
        .map((line) => line.match(/\[perf-json\] (\{.*\})\s*$/)?.[1])
        .filter(Boolean)
        .map((json) => JSON.parse(json));
    },

    /** Les écrans visités depuis le dernier `clearLog` : les marques `écran:<route>` du mode de mesure, sans doublons successifs. */
    screens() {
      const out = adb(["logcat", "-d", "-s", "TentaclePerf:I"]);
      return [...out.matchAll(/écran:(\w+)/g)].map((m) => m[1]).filter((name, i, all) => name !== all[i - 1]);
    },

    /** Attend qu'un écran se dise prêt (`prêt:<name>`) ; rend sa mesure, ou null. */
    async waitReady(name, timeoutMs = 30_000) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const ready = this.perfRecords().find((record) => record.ready === name);
        if (ready) return ready;
        await sleep(400);
      }
      return null;
    },

    /** Attend la fin des images : plus aucune fenêtre nouvelle pendant `quietMs`. */
    async waitQuiet(quietMs = 1500, timeoutMs = 15_000) {
      const end = Date.now() + timeoutMs;
      let count = this.perfRecords().length;
      let stableSince = Date.now();
      while (Date.now() < end) {
        await sleep(300);
        const next = this.perfRecords().length;
        if (next !== count) {
          count = next;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= quietMs) {
          return;
        }
      }
    },

    /** Le temps processeur (ns) de chaque fil de l'app, par nom (`/proc/<pid>/task/*`). */
    threadCpu() {
      const pid = this.pid();
      if (!pid) return {};
      const out = shell(`for t in /proc/${pid}/task/*; do echo "$(basename $t)|$(cat $t/comm)|$(cut -d' ' -f1 $t/schedstat)"; done 2>/dev/null`);
      const cpu = {};
      for (const line of out.split("\n")) {
        const [tid, comm, ns] = line.trim().split("|");
        if (!comm || !ns) continue;
        const name = tid === pid ? "main" : comm;
        cpu[name] = (cpu[name] ?? 0) + Number(ns);
      }
      return cpu;
    },

    /** La mémoire du processus (`dumpsys meminfo`, « App Summary », en Ko) :
     *  PSS total, tas Java, natif (bitmaps compris depuis Android 8), graphique
     *  (textures, tampons GL), code, pile, système. */
    memory() {
      const text = shell(`dumpsys meminfo ${PACKAGE}`);
      const num = (re) => Number(text.match(re)?.[1] ?? NaN);
      return {
        pss: num(/TOTAL PSS:\s+(\d+)/) || num(/TOTAL:\s+(\d+)/),
        rss: num(/TOTAL RSS:\s+(\d+)/),
        java: num(/Java Heap:\s+(\d+)/),
        native: num(/Native Heap:\s+(\d+)/),
        graphics: num(/Graphics:\s+(\d+)/),
        code: num(/Code:\s+(\d+)/),
        stack: num(/Stack:\s+(\d+)/),
        privateOther: num(/Private Other:\s+(\d+)/),
        system: num(/System:\s+(\d+)/),
        views: num(/^\s*Views:\s+(\d+)/m),
        // La mémoire du GPU, ligne par ligne : la Shield (Tegra) range ses
        // textures dans « Other mtrack », que le résumé « Graphics » ne compte pas.
        eglMtrack: num(/^\s*EGL mtrack\s+(\d+)/m) || 0,
        glMtrack: num(/^\s*GL mtrack\s+(\d+)/m) || 0,
        otherMtrack: num(/^\s*Other mtrack\s+(\d+)/m) || 0,
      };
    },

    /** Les vues natives attachées et le poids de leurs listes d'affichage
     *  (`dumpsys gfxinfo`, « View hierarchy »), fenêtre par fenêtre. */
    viewHierarchy() {
      const text = shell(`dumpsys gfxinfo ${PACKAGE}`);
      const windows = [...text.matchAll(/(\d+) views, ([\d.,]+) kB of (?:display lists|render nodes)/g)].map((m) => ({ views: Number(m[1]), kb: Number(m[2].replace(",", ".")) }));
      return { views: windows.reduce((n, w) => n + w.views, 0), displayListKb: windows.reduce((n, w) => n + w.kb, 0), windows: windows.length };
    },

    /** Les effets coupés au PROCHAIN lancement (`debug.tentacle.fx`, lue par
     *  l'app de MESURE seulement) : liste séparée par des virgules, vide = aucun. */
    setFx(names) {
      shell(`setprop debug.tentacle.fx '${names.length ? names.join(",") : "none"}'`);
    },

    /** Le niveau de rendu forcé au PROCHAIN lancement (`debug.tentacle.lite`,
     *  L2) : `lite`, `normal`, ou `auto` (la propriété vidée : la détection). */
    setTier(tier) {
      shell(`setprop debug.tentacle.lite '${tier === "lite" ? 1 : tier === "normal" ? 0 : ""}'`);
    },

    screencap(file) {
      fs.writeFileSync(file, execFileSync(ADB, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 64 << 20 }));
    },
  };
}
