/**
 * La médiathèque synthétique de la suite : de courtes vidéos fabriquées par
 * le ffmpeg de l'image Jellyfin, nommées comme de vrais titres pour que TMDB
 * les reconnaisse. Aucune vraie œuvre n'est téléchargée.
 *
 * Elle couvre ce que Tentacle lit : plusieurs pistes audio et sous-titres
 * étiquetées (FR, EN, JA), des chapitres « Intro » / « Générique » (segments),
 * un film en deux versions, un ÉPISODE en deux versions (nouveauté 12.0), une
 * série à plusieurs saisons avec ses spéciaux, des bandes-annonces locales
 * `-trailer` et des dossiers d'extras (film, série, saison), du HEVC et de
 * l'AC3 pour les décisions de transcodage, et une bibliothèque mixte.
 */

import { createHash } from "node:crypto";

interface AudioTrack { lang: string; codec: "aac" | "ac3"; channels: 2 | 6 }
interface SubTrack { lang: string; forced?: boolean }
type Size = "360p" | "720p" | "1080p";

export interface MediaFile {
  /** Chemin relatif à la racine des médias (`/media`). */
  path: string;
  seconds: number;
  size: Size;
  video: "h264" | "hevc";
  audio: AudioTrack[];
  /** Sous-titres INTÉGRÉS (MKV seulement). */
  subs?: SubTrack[];
  /** Débuts de chapitres, en secondes. */
  chapters?: Array<{ at: number; title: string }>;
}

/** Sous-titres EXTERNES, à côté du fichier vidéo. */
interface Sidecar { path: string; lang: string; seconds: number }

const EN: AudioTrack = { lang: "eng", codec: "aac", channels: 2 };
const FR: AudioTrack = { lang: "fre", codec: "aac", channels: 2 };
const FR_51: AudioTrack = { lang: "fre", codec: "ac3", channels: 6 };
const JA: AudioTrack = { lang: "jpn", codec: "aac", channels: 2 };
const EPISODE_CHAPTERS = [{ at: 0, title: "Intro" }, { at: 8, title: "Épisode" }, { at: 52, title: "Générique" }];

const clip = (path: string, seconds = 10): MediaFile => ({ path, seconds, size: "360p", video: "h264", audio: [EN] });

const BBB = "movies/Big Buck Bunny (2008)";
const SINTEL = "movies/Sintel (2010)";
const BB = "shows/Breaking Bad (2008)";
const BEBOP = "shows/Cowboy Bebop (1998)";

export const MEDIA_FILES: MediaFile[] = [
  {
    path: `${BBB}/Big Buck Bunny (2008).mkv`, seconds: 60, size: "720p", video: "h264", audio: [EN],
    subs: [{ lang: "fre" }], chapters: [{ at: 0, title: "Intro" }, { at: 10, title: "Histoire" }, { at: 50, title: "Générique" }],
  },
  clip(`${BBB}/Big Buck Bunny (2008)-trailer.mp4`, 12),
  clip(`${BBB}/trailers/Teaser.mp4`),
  clip(`${BBB}/behind the scenes/Making of.mp4`, 12),
  clip(`${BBB}/featurettes/Storyboard.mp4`),
  clip(`${BBB}/deleted scenes/Scene coupee.mp4`, 8),
  clip(`${BBB}/extras/Bloopers.mp4`, 8),
  { path: `${SINTEL}/Sintel (2010) - 1080p.mkv`, seconds: 60, size: "1080p", video: "h264", audio: [EN, FR_51] },
  { path: `${SINTEL}/Sintel (2010) - 720p.mkv`, seconds: 60, size: "720p", video: "h264", audio: [EN] },
  { path: "movies/Tears of Steel (2012)/Tears of Steel (2012).mp4", seconds: 60, size: "720p", video: "hevc", audio: [{ lang: "eng", codec: "aac", channels: 6 }] },
  { path: "movies/Elephants Dream (2006)/Elephants Dream (2006).mkv", seconds: 45, size: "360p", video: "h264", audio: [{ lang: "eng", codec: "ac3", channels: 2 }] },
  { path: "movies/Cosmos Laundromat (2015)/Cosmos Laundromat (2015).mkv", seconds: 45, size: "360p", video: "h264", audio: [EN, FR] },
  {
    path: `${BB}/Season 01/Breaking Bad - S01E01 - Pilot.mkv`, seconds: 60, size: "720p", video: "h264",
    audio: [EN, FR], subs: [{ lang: "fre" }, { lang: "eng", forced: true }], chapters: EPISODE_CHAPTERS,
  },
  { path: `${BB}/Season 01/Breaking Bad - S01E02.mkv`, seconds: 60, size: "360p", video: "h264", audio: [EN, FR], chapters: EPISODE_CHAPTERS },
  { path: `${BB}/Season 01/Breaking Bad - S01E03.mkv`, seconds: 60, size: "360p", video: "h264", audio: [EN, FR] },
  // Deux versions d'un même épisode : regroupées en une seule entrée à partir de 12.0.
  { path: `${BB}/Season 02/Breaking Bad - S02E01 - 1080p.mkv`, seconds: 45, size: "1080p", video: "h264", audio: [EN] },
  { path: `${BB}/Season 02/Breaking Bad - S02E01 - 720p.mkv`, seconds: 45, size: "720p", video: "h264", audio: [EN] },
  { path: `${BB}/Season 02/Breaking Bad - S02E02.mkv`, seconds: 45, size: "360p", video: "h264", audio: [EN] },
  { path: `${BB}/Specials/Breaking Bad - S00E01.mkv`, seconds: 30, size: "360p", video: "h264", audio: [EN] },
  clip(`${BB}/trailers/Bande-annonce.mp4`),
  clip(`${BB}/extras/Coulisses.mp4`),
  clip(`${BB}/Season 01/extras/Retour sur la saison.mp4`),
  { path: `${BEBOP}/Season 01/Cowboy Bebop - S01E01.mkv`, seconds: 45, size: "360p", video: "h264", audio: [JA, FR], subs: [{ lang: "fre" }, { lang: "eng" }] },
  // Doublage en PREMIÈRE piste (par défaut), VO en seconde : la préférence
  // « VO » doit aller la chercher (langue originale, nouveauté 12.0).
  { path: `${BEBOP}/Season 01/Cowboy Bebop - S01E02.mkv`, seconds: 45, size: "360p", video: "h264", audio: [FR, JA], subs: [{ lang: "fre" }] },
  clip("mixed/Night of the Living Dead (1968)/Night of the Living Dead (1968).mkv", 30),
  clip("mixed/Pioneer One (2010)/Season 01/Pioneer One - S01E01.mkv", 30),
];

const SIDECARS: Sidecar[] = [
  { path: `${SINTEL}/Sintel (2010) - 1080p.fr.srt`, lang: "fre", seconds: 60 },
  { path: `${SINTEL}/Sintel (2010) - 1080p.en.forced.srt`, lang: "eng", seconds: 60 },
];

/** Empreinte de la médiathèque : on ne régénère que si elle change. */
export const MEDIA_STAMP = createHash("sha1").update(JSON.stringify([MEDIA_FILES, SIDECARS])).digest("hex").slice(0, 12);

const SIZES: Record<Size, string> = { "360p": "640x360", "720p": "1280x720", "1080p": "1920x1080" };
const GREETING: Record<string, string> = { fre: "Bonjour", eng: "Hello", jpn: "こんにちは" };

/** Guillemets simples pour bash, apostrophes comprises. */
const q = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

function srtBody(lang: string, seconds: number): string {
  const cues: string[] = [];
  for (let i = 0, t = 1; t + 3 < seconds; i += 1, t += 10) {
    const ts = (s: number): string => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")},000`;
    cues.push(`${i + 1}\n${ts(t)} --> ${ts(t + 3)}\n${GREETING[lang] ?? lang} ${i + 1}\n`);
  }
  return cues.join("\n");
}

function chaptersBody(file: MediaFile): string {
  const lines = [";FFMETADATA1"];
  const chapters = file.chapters ?? [];
  chapters.forEach((c, i) => {
    const end = i + 1 < chapters.length ? chapters[i + 1].at : file.seconds;
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${c.at * 1000}`, `END=${end * 1000}`, `title=${c.title}`);
  });
  return lines.join("\n") + "\n";
}

function ffmpegCommand(file: MediaFile, index: number): string[] {
  const out = `/media/${file.path}`;
  const mkv = out.endsWith(".mkv");
  const lines = [`mkdir -p ${q(out.replace(/\/[^/]+$/, ""))}`];
  const inputs = [`-f lavfi -i ${q(`testsrc2=size=${SIZES[file.size]}:rate=24:duration=${file.seconds}`)}`];
  file.audio.forEach((_, i) => inputs.push(`-f lavfi -i ${q(`sine=frequency=${440 + i * 110}:sample_rate=48000:duration=${file.seconds}`)}`));
  const subs = mkv ? file.subs ?? [] : [];
  subs.forEach((s, i) => {
    const srt = `/tmp/sub_${index}_${i}.srt`;
    lines.push(`printf '%s' ${q(srtBody(s.lang, file.seconds))} > ${srt}`);
    inputs.push(`-i ${srt}`);
  });
  const maps = ["-map 0:v", ...file.audio.map((_, i) => `-map ${i + 1}:a`), ...subs.map((_, i) => `-map ${file.audio.length + 1 + i}:s`)];
  if (file.chapters?.length) {
    const meta = `/tmp/chapters_${index}.txt`;
    lines.push(`printf '%s' ${q(chaptersBody(file))} > ${meta}`);
    inputs.push(`-i ${meta}`);
    maps.push(`-map_chapters ${inputs.length - 1}`);
  }
  const codec = file.video === "hevc"
    ? `-c:v libx265 -preset ultrafast -x265-params log-level=error${mkv ? "" : " -tag:v hvc1"}`
    : "-c:v libx264 -preset ultrafast";
  const audio = file.audio.map((a, i) => [
    `-c:a:${i} ${a.codec} -ac:a:${i} ${a.channels} -b:a:${i} ${a.codec === "ac3" ? "384k" : "128k"}`,
    `-metadata:s:a:${i} language=${a.lang}`,
    `-disposition:a:${i} ${i === 0 ? "default" : "0"}`,
  ].join(" "));
  const subArgs = subs.map((s, i) => `-metadata:s:s:${i} language=${s.lang} -disposition:s:${i} ${s.forced ? "forced" : "0"}`);
  lines.push([
    "$FF -hide_banner -loglevel error -y", ...inputs, ...maps,
    `${codec} -g 48 -keyint_min 48 -pix_fmt yuv420p`, ...audio,
    subs.length ? "-c:s srt" : "", ...subArgs, q(out),
  ].filter(Boolean).join(" "));
  return lines;
}

/** Le script bash complet, joué dans un conteneur de l'image Jellyfin. */
export function mediaScript(): string {
  const lines = [
    "set -euo pipefail",
    "FF=/usr/lib/jellyfin-ffmpeg/ffmpeg",
    `STAMP=/media/.tentacle-compat-media`,
    `if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = ${q(MEDIA_STAMP)} ]; then echo "médiathèque déjà à jour"; exit 0; fi`,
    "find /media -mindepth 1 -delete",
  ];
  MEDIA_FILES.forEach((file, i) => lines.push(...ffmpegCommand(file, i)));
  for (const side of SIDECARS) lines.push(`printf '%s' ${q(srtBody(side.lang, side.seconds))} > ${q(`/media/${side.path}`)}`);
  lines.push(`printf '%s' ${q(MEDIA_STAMP)} > "$STAMP"`, `echo "médiathèque générée : ${MEDIA_FILES.length} vidéos"`);
  return lines.join("\n");
}
