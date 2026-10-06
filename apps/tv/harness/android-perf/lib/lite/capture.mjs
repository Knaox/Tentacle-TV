// Les relevés du banc Lite, lus par adb : `dumpsys gfxinfo` (toutes les
// fenêtres de l'app, avec la part du fil UI), `dumpsys meminfo` (PSS par
// poste : Java, natif, graphique…) et une trace Perfetto. Les fonctions
// `parse*` sont pures (testées hors appareil, `test/lite.test.mjs`).
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");

/**
 * `dumpsys gfxinfo <pkg>` : images, images ratées, centiles, et les causes que
 * relève Android — « Slow UI thread » (le fil UI a dépassé l'image), envoi
 * des bitmaps, commandes de dessin.
 */
export function parseGfxinfo(text) {
  const num = (re) => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    frames: num(/Total frames rendered: (\d+)/),
    // Android 12+ : « Janky frames » se lit sur la chronologie de
    // SurfaceFlinger (0 à l'émulateur, mesuré) ; « (legacy) » est la
    // définition d'avant (image > 16,7 ms), comparable d'une version à l'autre.
    janky: num(/Janky frames: (\d+)/),
    jankyLegacy: num(/Janky frames \(legacy\): (\d+)/),
    p50: num(/50th percentile: (\d+)ms/),
    p90: num(/90th percentile: (\d+)ms/),
    p95: num(/95th percentile: (\d+)ms/),
    p99: num(/99th percentile: (\d+)ms/),
    missedVsync: num(/Number Missed Vsync: (\d+)/),
    highInputLatency: num(/Number High input latency: (\d+)/),
    slowUiThread: num(/Number Slow UI thread: (\d+)/),
    slowBitmapUploads: num(/Number Slow bitmap uploads: (\d+)/),
    slowDrawCommands: num(/Number Slow issue draw commands: (\d+)/),
    deadlineMissed: num(/Number Frame deadline missed: (\d+)/),
    deadlineMissedLegacy: num(/Number Frame deadline missed \(legacy\): (\d+)/),
  };
}

/**
 * `dumpsys meminfo <pkg>` : le résumé de l'app (« App Summary », Pss en Ko)
 * et quelques objets (vues, activités). Les valeurs rendues sont en Mo.
 */
export function parseMeminfo(text) {
  const summary = text.slice(text.indexOf("App Summary"));
  const kb = (label) => {
    const m = summary.match(new RegExp(`${label}:\\s+(\\d+)`));
    return m ? Math.round(Number(m[1]) / 102.4) / 10 : null;
  };
  const object = (label) => {
    const m = text.match(new RegExp(`\\b${label}:\\s+(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  return {
    totalPss: kb("TOTAL PSS") ?? kb("TOTAL"),
    javaHeap: kb("Java Heap"),
    nativeHeap: kb("Native Heap"),
    code: kb("Code"),
    stack: kb("Stack"),
    graphics: kb("Graphics"),
    privateOther: kb("Private Other"),
    system: kb("System"),
    totalRss: kb("TOTAL RSS"),
    views: object("Views"),
    activities: object("Activities"),
  };
}

/** Le relevé mémoire du système : RAM totale et disponible (Mo). */
export function parseProcMeminfo(text) {
  const mb = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"));
    return m ? Math.round(Number(m[1]) / 1024) : null;
  };
  return { totalMb: mb("MemTotal"), availableMb: mb("MemAvailable"), swapFreeMb: mb("SwapFree") };
}

export function createCapture(serial, pkg) {
  const shell = (command, options = {}) => execFileSync(ADB, ["-s", serial, "shell", command], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 60_000, ...options });
  return {
    gfxReset: () => shell(`dumpsys gfxinfo ${pkg} reset`),
    gfx: () => parseGfxinfo(shell(`dumpsys gfxinfo ${pkg}`)),
    meminfo: () => parseMeminfo(shell(`dumpsys meminfo ${pkg}`)),
    system: () => parseProcMeminfo(shell("cat /proc/meminfo")),
    /** Les morts du lowmemorykiller depuis le dernier effacement du journal. */
    lmkKills: () => shell("logcat -d -b events -s am_low_memory:* am_kill:* 2>/dev/null; logcat -d -s lowmemorykiller:* 2>/dev/null").split("\n").filter((l) => /kill/i.test(l)),
  };
}

/** La config Perfetto (texte) : tranches du système et de l'app, compteurs mémoire, fils. */
export function perfettoConfig(pkg, durationMs) {
  return `
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
buffers { size_kb: 4096 fill_policy: RING_BUFFER }
data_sources { config { name: "linux.ftrace" target_buffer: 0 ftrace_config {
  ftrace_events: "sched/sched_switch" ftrace_events: "power/cpu_frequency" ftrace_events: "sched/sched_process_exit"
  ftrace_events: "lowmemorykiller/lowmemory_kill" ftrace_events: "oom/oom_score_adj_update"
  atrace_categories: "gfx" atrace_categories: "view" atrace_categories: "input" atrace_categories: "am"
  atrace_categories: "wm" atrace_categories: "dalvik" atrace_categories: "res" atrace_categories: "memory"
  atrace_apps: "${pkg}"
} } }
data_sources { config { name: "linux.process_stats" target_buffer: 1 process_stats_config { scan_all_processes_on_start: true proc_stats_poll_ms: 1000 } } }
data_sources { config { name: "linux.sys_stats" target_buffer: 1 sys_stats_config { meminfo_period_ms: 1000 meminfo_counters: MEMINFO_MEM_AVAILABLE meminfo_counters: MEMINFO_MEM_FREE meminfo_counters: MEMINFO_CACHED } } }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
duration_ms: ${durationMs}
`;
}

/**
 * Une trace Perfetto en arrière-plan sur l'appareil ; `stop(file)` l'arrête
 * (SIGTERM : Perfetto écrit sa trace) et la rapatrie. `durationMs` est un
 * plafond de sûreté.
 */
export function startPerfetto(serial, pkg, durationMs = 300_000) {
  const remote = `/data/misc/perfetto-traces/lite-${Date.now()}.pftrace`;
  const out = execFileSync(ADB, ["-s", serial, "shell", `perfetto --background --txt -c - -o ${remote}`], { input: perfettoConfig(pkg, durationMs), encoding: "utf8" });
  const pid = out.trim().split(/\s+/).pop();
  if (!/^\d+$/.test(pid)) throw new Error(`perfetto n'a pas démarré : ${out.trim()}`);
  return {
    async stop(file) {
      execFileSync(ADB, ["-s", serial, "shell", `kill -TERM ${pid}`], { stdio: "ignore" });
      for (let i = 0; i < 40; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const alive = execFileSync(ADB, ["-s", serial, "shell", `kill -0 ${pid} 2>/dev/null && echo oui || echo non`], { encoding: "utf8" }).trim();
        if (alive === "non") break;
      }
      execFileSync(ADB, ["-s", serial, "pull", remote, file], { stdio: "ignore" });
      execFileSync(ADB, ["-s", serial, "shell", `rm -f ${remote}`], { stdio: "ignore" });
      return file;
    },
  };
}
