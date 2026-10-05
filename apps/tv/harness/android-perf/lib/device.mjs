// L'appareil du banc, par adb : installation, session du faux backend, mode
// de mesure, touches à temps précis (`keys/Keys.java`), journal `[perf-json]`
// et temps processeur de chaque fil de l'app.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PACKAGE = "com.tentacletv.mobile";
const ACTIVITY = `${PACKAGE}/com.tentacletv.MainActivity`;
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");
const KEYS_DEX = "/data/local/tmp/perf-keys.dex";

export const KEY = { up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4, playPause: 85 };

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDevice(serial = process.env.ANDROID_SERIAL ?? "emulator-5584") {
  const adb = (args, options = {}) => execFileSync(ADB, ["-s", serial, ...args], { encoding: "utf8", maxBuffer: 256 << 20, ...options });
  const shell = (command, options) => adb(["shell", command], options);

  return {
    serial,
    adb,
    shell,

    describe() {
      const prop = (name) => shell(`getprop ${name}`).trim();
      return `${prop("ro.product.model")} · Android ${prop("ro.build.version.release")} (API ${prop("ro.build.version.sdk")}) · ${prop("ro.hardware.egl")}`;
    },

    install(apk) {
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

    /** Une séquence de touches (`Keys.java`) : `tap:22`, `tap:22x6@500`, `hold:20:3000`, `wait:800`. */
    keys(...steps) {
      if (steps.length === 0) return;
      shell(`CLASSPATH=${KEYS_DEX} app_process /system/bin Keys ${steps.join(" ")}`, { timeout: 120_000 });
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

    screencap(file) {
      fs.writeFileSync(file, execFileSync(ADB, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 64 << 20 }));
    },
  };
}
