// Jeux de données du domaine « lecteur » (T5) — voir README.md.
//
// Le faux Jellyfin ne sert aucun flux : sans jeu, le lecteur s'ouvre en échec.
// « flux-mp4 » fait d'un film de l'instantané une vraie vidéo, lue en direct
// par AVPlayer : un MP4 H.264 / AAC de 10 min, généré une fois dans le cache de
// la machine (`ffmpeg`, voir README), servi avec les plages d'octets. Les jeux
// `flux-h264-ac3`, `flux-hevc-eac3` et `flux-hdr10-eac3` font de même avec des
// MKV 1080p à 23,976 i/s et un son 5.1 (le démarrage du lecteur d'Android TV :
// bascule de fréquence, son en passthrough, HDR) — README, « Démarrage ».
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE = path.join(os.homedir(), "Library/Caches/tentacle-nav-golden/lecteur");
export const VIDEO = path.join(CACHE, "banc-600s.mp4");
/** « Orgueil et Préjugés », la première carte de Reprendre (reprise à 46 s). */
export const FILM = "e86346a08c2bb2900795777307b0a32d";
const ticks = (seconds) => Math.round(seconds * 10_000_000);

function serveFile(file, type) {
  return (req, res) => {
    const size = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    const head = req.method === "HEAD";
    if (!range) {
      res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
      if (head) return res.end();
      return fs.createReadStream(file).pipe(res);
    }
    const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    const end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {
      "Content-Type": type, "Content-Length": end - start + 1, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${size}`,
    });
    if (head) return res.end();
    const stream = fs.createReadStream(file, { start, end });
    res.on("close", () => stream.destroy());
    return stream.pipe(res);
  };
}

/** « Orgueil et Préjugés » devient `file`, lu en direct : sa source et ses flux. */
function directFile({ file, container, type, seconds, bitrate, video, audio, subtitle }) {
  return (data) => {
    if (!fs.existsSync(file)) throw new Error(`vidéo du banc absente (${file}) : voir scenarios/lecteur/README.md`);
    const streams = [{ Index: 0, Type: "Video", IsDefault: true, ...video }, { Index: 1, Type: "Audio", Language: "fre", IsDefault: true, ...audio }];
    if (subtitle) streams.push({ Index: 2, Type: "Subtitle", Language: "fre", IsExternal: false, IsDefault: true, ...subtitle });
    const source = {
      Id: FILM, Name: "banc", Container: container, Protocol: "File", Path: `/banc/${path.basename(file)}`, Type: "Default",
      Size: fs.statSync(file).size, RunTimeTicks: ticks(seconds), Bitrate: bitrate,
      SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: false, MediaStreams: streams,
    };
    data.patchItem(FILM, { RunTimeTicks: ticks(seconds), MediaSources: [source], MediaStreams: streams });
    const serve = serveFile(file, type);
    data.route("GET", /^\/api\/jellyfin\/Videos\/[0-9a-f]{32}\/stream/i, serve);
    data.route("HEAD", /^\/api\/jellyfin\/Videos\/[0-9a-f]{32}\/stream/i, serve);
  };
}

/** Un MKV 1080p à 23,976 i/s, son 5.1 — les trois du démarrage d'Android TV. */
const mkv = (name, video, audio) => directFile({
  file: path.join(CACHE, name), container: "mkv", type: "video/x-matroska", seconds: 90, bitrate: 6_400_000,
  video: { Width: 1920, Height: 1080, RealFrameRate: 23.976025, AverageFrameRate: 23.976025, BitRate: 6_000_000, ...video },
  audio: { Channels: 6, ChannelLayout: "5.1", SampleRate: 48000, BitRate: 384_000, ...audio },
});

const fluxMp4 = {
  description: "« Orgueil et Préjugés » (Reprendre [0]) devient un MP4 H.264/AAC de 10 min lu en direct — le lecteur joue pour de vrai",
  apply: directFile({
    file: VIDEO, container: "mp4", type: "video/mp4", seconds: 600, bitrate: 370_000,
    video: { Codec: "h264", Width: 640, Height: 360, VideoRange: "SDR", VideoRangeType: "SDR", BitRate: 300_000 },
    audio: { Codec: "aac", Channels: 2, DisplayTitle: "Français - AAC - Stéréo" },
  }),
};

/** Le segment Intro du jeu `flux-mp4-intro` : 5 s → 9 min 50, presque toute la
 *  vidéo — la reprise y tombe, où que la lecture précédente se soit arrêtée. */
const INTRO = { start: 5, end: 590 };

/**
 * Les jeux de la tâche L4 (coût du son décodé et des sous-titres sur une box
 * faible) : la même image légère (H.264 640×360, décodée par l'hôte de
 * l'émulateur) et un son ou un sous-titre LOURD — seul le coût de ce qui se
 * décode ou se rend sur le processeur de l'appareil se lit. Fichiers dans
 * `lecteur/l4/` (README, « Jeux L4 »).
 */
const L4 = path.join(CACHE, "l4");
const l4Video = { Codec: "h264", Width: 640, Height: 360, VideoRange: "SDR", VideoRangeType: "SDR", BitRate: 300_000 };
function l4(name, audio, subtitle = null, { video = l4Video, seconds = subtitle ? 270 : 240 } = {}) {
  const file = path.join(L4, `l4-${name}.mkv`);
  const apply = directFile({ file, container: "mkv", type: "video/x-matroska", seconds, bitrate: (video.BitRate ?? 0) + 256_000, video, audio, subtitle });
  return {
    description: `L4 : « Orgueil et Préjugés » devient l4-${name}.mkv (image légère, ${subtitle ? `sous-titre ${subtitle.Codec} choisi` : `son ${audio.Codec}`})`,
    apply: (data) => {
      apply(data);
      // Le sous-titre choisi d'office (préférences de pistes résolues par Tentacle).
      if (subtitle) data.route("POST", /^\/api\/preferences\/.*resolve/, (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ audioIndex: 1, subtitleIndex: 2 }));
      });
      // Un sous-titre TEXTE se lit, sur Android TV, en WebVTT converti par
      // Jellyfin (`Subtitles/<i>/Stream.vtt`, chargé à côté de la vidéo) : le
      // même ASS lourd, converti par ffmpeg comme Jellyfin le fait.
      if (subtitle?.Codec === "ass") data.route("GET", /\/Subtitles\/\d+\/Stream\.vtt/, serveFile(path.join(L4, "heavy.vtt"), "text/vtt"));
    },
  };
}
const l4Aac = { Codec: "aac", Channels: 2, SampleRate: 48000, DisplayTitle: "Français - AAC - Stéréo" };

export default {
  "flux-l4-truehd": l4("truehd71", { Codec: "truehd", Channels: 6, SampleRate: 48000, DisplayTitle: "Français - TrueHD - 5.1" }),
  "flux-l4-dts": l4("dts51", { Codec: "dts", Channels: 6, SampleRate: 48000, DisplayTitle: "Français - DTS - 5.1" }),
  "flux-l4-eac3": l4("eac351", { Codec: "eac3", Channels: 6, SampleRate: 48000, DisplayTitle: "Français - Dolby Digital+ - 5.1" }),
  "flux-l4-ac3": l4("ac351", { Codec: "ac3", Channels: 6, SampleRate: 48000, DisplayTitle: "Français - Dolby Digital - 5.1" }),
  "flux-l4-aac": l4("aac20", l4Aac),
  "flux-l4-ass": l4("ass", l4Aac, { Codec: "ass", DisplayTitle: "Français - ASS" }),
  "flux-l4-pgs": l4("pgs", l4Aac, { Codec: "PGSSUB", DisplayTitle: "Français - PGS" }),
  // Une image à ~30 Mb/s (sous le plafond Lite de 50) : ce que le TAMPON d'Exo garde en mémoire.
  "flux-l4-debit": l4("debit", l4Aac, null, { video: { ...l4Video, BitRate: 30_000_000 }, seconds: 120 }),
  "flux-mp4": fluxMp4,
  "flux-mp4-intro": {
    description: "« flux-mp4 », plus un segment Intro (5 s → 9 min 50) : la reprise montre la pilule « Passer l'intro », au bouton (pas de saut automatique)",
    apply: (data) => {
      fluxMp4.apply(data);
      // Le contrat résolu par le serveur (`/api/playback/segments`, shared `segmentTypes.ts`).
      data.route("GET", /^\/api\/playback\/segments\/[0-9a-f]{32}/i, (req, res) => {
        const body = JSON.stringify({
          version: 1, itemId: FILM, runtimeMs: 600_000, libraryId: null, resolvedAt: new Date().toISOString(),
          segments: [{ type: "Intro", startMs: INTRO.start * 1000, endMs: INTRO.end * 1000, source: "jellyfin" }],
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
      });
      // Le passage au BOUTON (« Passer »), pas automatique : la pilule attend OK.
      data.route("GET", /^\/api\/preferences\/playback/, (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ stored: true, settings: { intro: { action: "button" } } }));
      });
    },
  },
  "flux-h264-ac3": {
    description: "« Orgueil et Préjugés » : MKV H.264 1080p 23,976 i/s, AC-3 5.1 — démarrage d'Android TV, SDR",
    apply: mkv("banc-h264-ac3.mkv", { Codec: "h264", VideoRange: "SDR", VideoRangeType: "SDR" }, { Codec: "ac3", DisplayTitle: "Français - Dolby Digital - 5.1" }),
  },
  "flux-hevc-eac3": {
    description: "« Orgueil et Préjugés » : MKV HEVC 1080p 23,976 i/s, E-AC-3 5.1 — démarrage d'Android TV, HEVC SDR",
    apply: mkv("banc-hevc-eac3.mkv", { Codec: "hevc", VideoRange: "SDR", VideoRangeType: "SDR" }, { Codec: "eac3", DisplayTitle: "Français - Dolby Digital+ - 5.1" }),
  },
  "flux-hdr10-eac3": {
    description: "« Orgueil et Préjugés » : MKV HEVC Main10 HDR10 1080p 23,976 i/s, E-AC-3 5.1 — démarrage d'Android TV, HDR",
    apply: mkv("banc-hdr10-eac3.mkv", { Codec: "hevc", BitDepth: 10, VideoRange: "HDR", VideoRangeType: "HDR10", ColorPrimaries: "bt2020", ColorTransfer: "smpte2084", ColorSpace: "bt2020nc" }, { Codec: "eac3", DisplayTitle: "Français - Dolby Digital+ - 5.1" }),
  },
};
