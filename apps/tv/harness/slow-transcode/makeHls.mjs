#!/usr/bin/env node
// Le contenu du banc du transcodage lent : une mire de 10 min (compteur de
// secondes) et un son, découpés en segments TS de 6 s comme le HLS d'un
// transcodage Jellyfin (`SegmentContainer=ts`). Généré une fois, localement,
// par ffmpeg (~1 min) : aucun serveur réel n'est sollicité.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.HLS_DIR ?? path.join(HERE, "hls");

fs.mkdirSync(OUT, { recursive: true });
const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "testsrc=size=960x540:rate=24",
  "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
  "-t", "600",
  "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
  "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-b:v", "2500k",
  "-c:a", "aac", "-b:a", "128k", "-ac", "2",
  "-f", "hls", "-hls_time", "6", "-hls_list_size", "0", "-hls_segment_type", "mpegts",
  "-hls_segment_filename", path.join(OUT, "seg%d.ts"), path.join(OUT, "index.m3u8"),
];
const run = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (run.status !== 0) process.exit(run.status ?? 1);
console.log(`HLS prêt : ${fs.readdirSync(OUT).filter((f) => f.endsWith(".ts")).length} segments dans ${OUT}`);
