// Jeux de données du domaine « lecteur » (T5) — voir README.md.
//
// Le faux Jellyfin ne sert aucun flux : sans jeu, le lecteur s'ouvre en échec.
// « flux-mp4 » fait d'un film de l'instantané une vraie vidéo, lue en direct
// par AVPlayer : un MP4 H.264 / AAC de 10 min, généré une fois dans le cache de
// la machine (`ffmpeg`, voir README), servi avec les plages d'octets.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const VIDEO = path.join(os.homedir(), "Library/Caches/tentacle-nav-golden/lecteur/banc-600s.mp4");
/** « Orgueil et Préjugés », la première carte de Reprendre (reprise à 46 s). */
export const FILM = "e86346a08c2bb2900795777307b0a32d";
const TEN_MINUTES_TICKS = 6_000_000_000;

function serveVideo(req, res) {
  const size = fs.statSync(VIDEO).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  const head = req.method === "HEAD";
  if (!range) {
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": size, "Accept-Ranges": "bytes" });
    if (head) return res.end();
    return fs.createReadStream(VIDEO).pipe(res);
  }
  const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
  const end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), size - 1) : size - 1;
  res.writeHead(206, {
    "Content-Type": "video/mp4", "Content-Length": end - start + 1, "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${start}-${end}/${size}`,
  });
  if (head) return res.end();
  const stream = fs.createReadStream(VIDEO, { start, end });
  res.on("close", () => stream.destroy());
  return stream.pipe(res);
}

export default {
  "flux-mp4": {
    description: "« Orgueil et Préjugés » (Reprendre [0]) devient un MP4 H.264/AAC de 10 min lu en direct — le lecteur joue pour de vrai",
    apply: (data) => {
      if (!fs.existsSync(VIDEO)) throw new Error(`vidéo du banc absente (${VIDEO}) : voir scenarios/lecteur/README.md`);
      const source = {
        Id: FILM, Name: "banc", Container: "mp4", Protocol: "File", Path: "/banc/banc-600s.mp4", Type: "Default",
        Size: fs.statSync(VIDEO).size, RunTimeTicks: TEN_MINUTES_TICKS, Bitrate: 370_000,
        SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: false,
        MediaStreams: [
          { Index: 0, Type: "Video", Codec: "h264", Width: 640, Height: 360, IsDefault: true, VideoRange: "SDR", VideoRangeType: "SDR", BitRate: 300_000 },
          { Index: 1, Type: "Audio", Codec: "aac", Channels: 2, Language: "fre", IsDefault: true, DisplayTitle: "Français - AAC - Stéréo" },
        ],
      };
      data.patchItem(FILM, { RunTimeTicks: TEN_MINUTES_TICKS, MediaSources: [source], MediaStreams: source.MediaStreams });
      data.route("GET", /^\/api\/jellyfin\/Videos\/[0-9a-f]{32}\/stream/i, (req, res) => serveVideo(req, res));
      data.route("HEAD", /^\/api\/jellyfin\/Videos\/[0-9a-f]{32}\/stream/i, (req, res) => serveVideo(req, res));
    },
  },
};
