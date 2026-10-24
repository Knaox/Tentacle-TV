/* eslint-disable */
// Banc Octave : l'écart entre « Jellyfin voit le titre » et « l'index du cœur le connaît » (donc
// `jellyfin.findByMbid`), avec les défauts de Jellyfin (LibraryMonitorDelay 60 s, LibraryUpdateDuration
// 30 s) le temps de la mesure, puis REMIS à leurs valeurs d'avant.
//   avant : refresh seul — l'index attend le LibraryChanged du backend (:3103, socket de compte connectée) ;
//   après : jellyfin.refreshPath — le dossier rafraîchi s'indexe tout de suite ;
//   filet : refresh seul, puis jellyfin.findByMbid appelé en boucle (relecture bornée des derniers ajouts).
//   cd apps/backend && TENTACLE_DATA_DIR=<données du banc> node "$(node -p 'require.resolve("tsx/cli")')" ../../bench/octave/measure-index.cts
const B = require("node:path").resolve(__dirname, "../../apps/backend/src");
const { execFileSync } = require("node:child_process");
const { mkdirSync, copyFileSync, rmSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { initPrisma } = require(B + "/services/db.ts");
const { detectAppState } = require(B + "/services/configStore.ts");
const host = require(B + "/music/host/jellyfinMusicHost.ts");
const { refreshContaining } = require(B + "/music/host/folderRefresh.ts");
const { getMusicLibrary } = require(B + "/music/jellyfin/musicLibrary.ts");
const { tracksByRecording } = require(B + "/music/index/indexQueries.ts");
const MUSIC = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-music";
const PY = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/.venv/bin/python";
const env = Object.fromEntries(require("fs").readFileSync("/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env", "utf8").split("\n").filter(Boolean).map((l: string) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const J = env.OCTAVE_JELLYFIN_URL, H = { Authorization: 'MediaBrowser Token="' + env.OCTAVE_JELLYFIN_API_KEY + '"', "Content-Type": "application/json" };
const SRC = MUSIC + "/Kevin MacLeod/Bright Piano Works (2007)/01 - Bright Wish.flac";
async function jf(method: string, path: string, body?: unknown) { const r = await fetch(J + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; }
function deposit(title: string, mbid: string): string {
  const dir = MUSIC + "/Kevin MacLeod/" + title + " (2026)"; mkdirSync(dir, { recursive: true });
  const file = dir + "/01 - " + title + ".flac"; copyFileSync(SRC, file);
  execFileSync(PY, ["-I", "-c", "import sys;from mutagen.flac import FLAC;f=FLAC(sys.argv[1]);f['TITLE']=[sys.argv[2]];f['ALBUM']=[sys.argv[2]];f['MUSICBRAINZ_TRACKID']=[sys.argv[3]];f['MUSICBRAINZ_ALBUMID']=[sys.argv[3]];f.save()", file, title, mbid]);
  return dir;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await initPrisma(); await detectAppState();
  const library = await getMusicLibrary();
  const cfg = await jf("GET", "/System/Configuration"); const before = { d: cfg.LibraryMonitorDelay, u: cfg.LibraryUpdateDuration };
  cfg.LibraryMonitorDelay = 60; cfg.LibraryUpdateDuration = 30; await jf("POST", "/System/Configuration", cfg);
  console.log(`LibraryMonitorDelay ${before.d} → 60, LibraryUpdateDuration ${before.u} → 30`);
  const dirs: string[] = [];
  try {
    for (const mode of ["avant", "après", "filet"]) {
      const tag = randomUUID().slice(0, 6), title = "Index " + tag, mbid = randomUUID();
      const dir = deposit(title, mbid); dirs.push(dir);
      const jfPath = dir.replace(MUSIC, "/music");
      const t0 = Date.now();
      if (mode === "après") await host.refreshPath({ path: jfPath }); else await refreshContaining(library, jfPath);
      let visible: number | null = null, indexed: number | null = null;
      while (Date.now() - t0 < 60_000 && indexed === null) {
        if (visible === null) {
          const d = await jf("GET", "/Items?Recursive=true&IncludeItemTypes=Audio&searchTerm=" + encodeURIComponent(title) + "&userId=" + env.OCTAVE_ADMIN_ID);
          if ((d?.Items ?? []).some((i: any) => i.Name === title)) visible = Date.now() - t0;
        }
        const known = mode === "filet" ? (await host.findByMbid({ recordings: [mbid] })).length > 0 : (await tracksByRecording([mbid])).length > 0;
        if (known) indexed = Date.now() - t0;
        else await sleep(100);
      }
      const f = (ms: number | null) => (ms === null ? "> 60 s" : (ms / 1000).toFixed(2) + " s");
      console.log(`${mode.padEnd(6)} vu par Jellyfin ${f(visible)} · connu de ${mode === "filet" ? "findByMbid" : "l'index"} ${f(indexed)} · écart ${visible !== null && indexed !== null ? ((indexed - visible) / 1000).toFixed(2) + " s" : "?"}`);
    }
  } finally {
    const now = await jf("GET", "/System/Configuration"); now.LibraryMonitorDelay = before.d; now.LibraryUpdateDuration = before.u; await jf("POST", "/System/Configuration", now);
    const back = await jf("GET", "/System/Configuration");
    console.log(`remis : LibraryMonitorDelay ${back.LibraryMonitorDelay}, LibraryUpdateDuration ${back.LibraryUpdateDuration}`);
    for (const d of dirs) { rmSync(d, { recursive: true, force: true }); await host.notifyPath({ path: d.replace(MUSIC, "/music"), change: "deleted" }).catch(() => undefined); }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
