/* eslint-disable */
// Banc Octave : temps jusqu'à ce que Jellyfin VOIE un titre déposé, selon la façon de le prévenir
// (`jellyfin.notifyPath` = /Library/Media/Updated, contre `jellyfin.refreshPath`). Pose
// LibraryMonitorDelay à 60 s (le défaut de Jellyfin) le temps de la mesure, puis le REMET.
//   cd apps/backend && TENTACLE_DATA_DIR=<données du banc> node "$(node -p 'require.resolve("tsx/cli")')" ../../bench/octave/measure-refresh.cts
const B = require("node:path").resolve(__dirname, "../../apps/backend/src");
const { execFileSync } = require("node:child_process");
const { mkdirSync, copyFileSync, rmSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { initPrisma } = require(B + "/services/db.ts");
const { detectAppState } = require(B + "/services/configStore.ts");
const host = require(B + "/music/host/jellyfinMusicHost.ts");
const MUSIC = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-music";
const PY = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/.venv/bin/python";
const env = Object.fromEntries(require("fs").readFileSync("/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env", "utf8").split("\n").filter(Boolean).map((l: string) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const J = env.OCTAVE_JELLYFIN_URL, H = { Authorization: 'MediaBrowser Token="' + env.OCTAVE_JELLYFIN_API_KEY + '"', "Content-Type": "application/json" };
const SRC = MUSIC + "/Kevin MacLeod/Bright Piano Works (2007)/01 - Bright Wish.flac";
async function jf(method: string, path: string, body?: unknown) { const r = await fetch(J + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; }
function deposit(artist: string, album: string, title: string): string {
  const dir = MUSIC + "/" + artist + "/" + album; mkdirSync(dir, { recursive: true });
  const file = dir + "/01 - " + title + ".flac"; copyFileSync(SRC, file);
  execFileSync(PY, ["-I", "-c", "import sys;from mutagen.flac import FLAC;f=FLAC(sys.argv[1]);f['TITLE']=[sys.argv[2]];f['ALBUM']=[sys.argv[3]];f['ARTIST']=[sys.argv[4]];f['ALBUMARTIST']=[sys.argv[4]];f['ARTISTS']=[sys.argv[4]];f['MUSICBRAINZ_TRACKID']=[sys.argv[5]];f['MUSICBRAINZ_ALBUMID']=[sys.argv[5]];f.save()", file, title, album, artist, randomUUID()]);
  return dir;
}
async function seen(title: string, t0: number, limitMs: number): Promise<number | null> {
  while (Date.now() - t0 < limitMs) {
    const d = await jf("GET", "/Items?Recursive=true&IncludeItemTypes=Audio&searchTerm=" + encodeURIComponent(title) + "&userId=" + env.OCTAVE_ADMIN_ID);
    if ((d?.Items ?? []).some((i: any) => i.Name === title)) return Date.now() - t0;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
(async () => {
  await initPrisma(); await detectAppState();
  const cfg = await jf("GET", "/System/Configuration"); const before = cfg.LibraryMonitorDelay;
  cfg.LibraryMonitorDelay = 60; await jf("POST", "/System/Configuration", cfg);
  console.log("LibraryMonitorDelay " + before + " → 60");
  const cleanup: string[] = [];
  try {
    for (const mode of ["notifyPath", "refreshPath (album connu)", "refreshPath", "refreshPath (artiste neuf)"]) {
      const tag = randomUUID().slice(0, 6);
      const artist = mode.includes("neuf") ? "Mesure A3 " + tag : "Kevin MacLeod";
      const title = "Mesure " + tag;
      const known = mode.includes("connu");
      const dir = deposit(artist, known ? "Bright Piano Works (2007)" : "Mesure " + tag + " (2026)", title);
      const file = dir + "/01 - " + title + ".flac";
      cleanup.push(known ? file : mode.includes("neuf") ? MUSIC + "/" + artist : dir);
      const t0 = Date.now();
      const r = mode === "notifyPath" ? await host.notifyPath({ path: dir.replace(MUSIC, "/music"), change: "created" }) : await host.refreshPath({ path: (known ? file : dir).replace(MUSIC, "/music") });
      const call = Date.now() - t0;
      const ms = await seen(title, t0, 90_000);
      console.log(mode.padEnd(28) + " appel " + String(call).padStart(4) + " ms → titre vu par Jellyfin en " + (ms === null ? "> 90 s" : (ms / 1000).toFixed(2) + " s") + "  " + JSON.stringify(r));
    }
  } finally {
    const now = await jf("GET", "/System/Configuration"); now.LibraryMonitorDelay = before; await jf("POST", "/System/Configuration", now);
    console.log("LibraryMonitorDelay remis à " + (await jf("GET", "/System/Configuration")).LibraryMonitorDelay);
    for (const p of cleanup) rmSync(p, { recursive: true, force: true });
    for (const p of cleanup) await host.notifyPath({ path: (p.endsWith("(2026)") ? p : p).replace(MUSIC, "/music"), change: "deleted" }).catch(() => undefined);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
