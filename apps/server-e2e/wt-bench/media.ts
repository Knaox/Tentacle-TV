/**
 * La médiathèque du banc Watch Together : une série synthétique de trois
 * épisodes de cinq minutes, fabriquée par le ffmpeg de l'image Jellyfin.
 *
 * Cinq minutes, c'est assez pour mesurer un régime établi (deux minutes de
 * lecture), un seek, une pause, et laisser la fin d'épisode enchaîner sur le
 * suivant. Les chapitres « Intro » (0 → 40 s) et « Générique » (les 25
 * dernières secondes) sont lus par le résolveur de segments du backend
 * (`segmentChapters.ts`) : c'est l'intro AU TOUT DÉBUT qu'on éprouve.
 *
 * L'image porte l'heure du film incrustée (drawtext) : une capture d'écran
 * dit à l'œil où en est chaque lecteur. Images clés toutes les 2 s.
 */

import { createHash } from "node:crypto";

export interface BenchEpisode {
  file: string;
  seconds: number;
}

export const SHOW_DIR = "shows/WT Banc (2026)";
export const EPISODES: BenchEpisode[] = [1, 2, 3].map((n) => ({
  file: `${SHOW_DIR}/Season 01/WT Banc - S01E0${n}.mkv`,
  seconds: 300,
}));
export const INTRO_END_S = 40;
export const CREDITS_LENGTH_S = 25;

export const MEDIA_STAMP = createHash("sha1").update(JSON.stringify([EPISODES, INTRO_END_S, CREDITS_LENGTH_S, 2])).digest("hex").slice(0, 12);

const q = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

function chapters(seconds: number): string {
  const marks = [
    { at: 0, title: "Intro" },
    { at: INTRO_END_S, title: "Episode" },
    { at: seconds - CREDITS_LENGTH_S, title: "Générique" },
  ];
  const lines = [";FFMETADATA1"];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : seconds;
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${m.at * 1000}`, `END=${end * 1000}`, `title=${m.title}`);
  });
  return `${lines.join("\n")}\n`;
}

/** Le script bash, joué dans un conteneur éphémère de l'image Jellyfin. */
export function mediaScript(): string {
  const lines = [
    "set -euo pipefail",
    "FF=/usr/lib/jellyfin-ffmpeg/ffmpeg",
    "STAMP=/media/.wt-bench-media",
    `if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = ${q(MEDIA_STAMP)} ]; then echo "médiathèque déjà à jour"; exit 0; fi`,
    "find /media -mindepth 1 -delete",
  ];
  EPISODES.forEach((ep, i) => {
    const out = `/media/${ep.file}`;
    const meta = `/tmp/chapters_${i}.txt`;
    // Heure du film en grand (l'œil compare deux captures), fréquence audio
    // propre à l'épisode (l'oreille reconnaît l'épisode).
    const draw = "drawtext=text='%{pts\\:hms}':fontsize=96:fontcolor=white:box=1:boxcolor=black@0.6:x=(w-tw)/2:y=h-th-40";
    lines.push(
      `mkdir -p ${q(out.replace(/\/[^/]+$/, ""))}`,
      `printf '%s' ${q(chapters(ep.seconds))} > ${meta}`,
      [
        "$FF -hide_banner -loglevel error -y",
        `-f lavfi -i ${q(`testsrc2=size=1280x720:rate=24:duration=${ep.seconds}`)}`,
        `-f lavfi -i ${q(`sine=frequency=${330 + i * 110}:sample_rate=48000:duration=${ep.seconds}`)}`,
        `-i ${meta}`,
        "-map 0:v -map 1:a -map_chapters 2",
        // drawtext absent d'une image : on retombe sur l'image nue, sans échouer.
        `-vf ${q(draw)}`,
        "-c:v libx264 -preset veryfast -b:v 6M -maxrate 8M -bufsize 8M -g 48 -keyint_min 48 -pix_fmt yuv420p",
        "-c:a aac -ac 2 -b:a 128k -metadata:s:a:0 language=eng",
        q(out),
        `|| $FF -hide_banner -loglevel error -y -f lavfi -i ${q(`testsrc2=size=1280x720:rate=24:duration=${ep.seconds}`)}`,
        `-f lavfi -i ${q(`sine=frequency=${330 + i * 110}:sample_rate=48000:duration=${ep.seconds}`)} -i ${meta}`,
        "-map 0:v -map 1:a -map_chapters 2 -c:v libx264 -preset veryfast -b:v 6M -maxrate 8M -bufsize 8M -g 48 -keyint_min 48 -pix_fmt yuv420p",
        `-c:a aac -ac 2 -b:a 128k -metadata:s:a:0 language=eng ${q(out)}`,
      ].join(" "),
    );
  });
  lines.push(`printf '%s' ${q(MEDIA_STAMP)} > "$STAMP"`, `echo "médiathèque générée : ${EPISODES.length} épisodes"`);
  return lines.join("\n");
}
