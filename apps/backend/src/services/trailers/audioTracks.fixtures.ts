/* ------------------------------------------------------------------ */
/*  Maîtres et formats YouTube à plusieurs pistes audio — relevés      */
/*                                                                     */
/*  Relevés le 2026-10-16 (yt-dlp 2026.08.19, client `visionos`) sur   */
/*  deux vraies vidéos, puis abrégés : quelques langues, trois         */
/*  variantes ; hôte et adresse IP remplacés (googlevideo.test,        */
/*  203.0.113.7). Les attributs YouTube (`YT-EXT-XTAGS`, NAME, URI)    */
/*  sont ceux reçus, à l'octet près. Pour les tests seulement.        */
/* ------------------------------------------------------------------ */

export const GV = "https://manifest.googlevideo.test/api/manifest/hls_playlist/expire/1790970374/ip/203.0.113.7";
export const BASE = `${GV}/file/index.m3u8`;

/**
 * Doublages AUTOMATIQUES (`acont=dubbed-auto`, NAME « … - dubbed-auto »,
 * identifiant `.10`) à côté de l'originale anglaise : toutes les pistes
 * `AUTOSELECT=YES`, aucune par défaut — un lecteur en français prend la
 * voix de synthèse.
 */
export const AUTO_DUBBED_MASTER = [
  "#EXTM3U",
  "#EXT-X-INDEPENDENT-SEGMENTS",
  `#EXT-X-MEDIA:URI="${GV}/itag/233/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed-auto:lang%3Dde-DE/index.m3u8",TYPE=AUDIO,GROUP-ID="233",LANGUAGE="de-DE",NAME="Deutsch (Deutschland) - dubbed-auto",YT-EXT-XTAGS="ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVkZS1ERQ",YT-EXT-AUDIO-CONTENT-ID="de-DE.10",YT-EXT-ABSOLUTE-LOUDNESS=-19.860,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/233/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed-auto:lang%3Dfr-FR/index.m3u8",TYPE=AUDIO,GROUP-ID="233",LANGUAGE="fr-FR",NAME="Français (France) - dubbed-auto",YT-EXT-XTAGS="ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVmci1GUg",YT-EXT-AUDIO-CONTENT-ID="fr-FR.10",YT-EXT-ABSOLUTE-LOUDNESS=-18.990,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/233/sgoap/itag%3D140%3Bxtags%3Dacont%3Doriginal:lang%3Den-US/index.m3u8",TYPE=AUDIO,GROUP-ID="233",LANGUAGE="en-US",NAME="American English - original",YT-EXT-XTAGS="ChEKBWFjb250EghvcmlnaW5hbAoNCgRsYW5nEgVlbi1VUw",YT-EXT-AUDIO-CONTENT-ID="en-US.4",YT-EXT-ABSOLUTE-LOUDNESS=-19.370,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed-auto:lang%3Dde-DE/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="de-DE",NAME="Deutsch (Deutschland) - dubbed-auto",YT-EXT-XTAGS="ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVkZS1ERQ",YT-EXT-AUDIO-CONTENT-ID="de-DE.10",YT-EXT-ABSOLUTE-LOUDNESS=-19.860,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed-auto:lang%3Dfr-FR/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="fr-FR",NAME="Français (France) - dubbed-auto",YT-EXT-XTAGS="ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVmci1GUg",YT-EXT-AUDIO-CONTENT-ID="fr-FR.10",YT-EXT-ABSOLUTE-LOUDNESS=-18.990,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Doriginal:lang%3Den-US/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="en-US",NAME="American English - original",YT-EXT-XTAGS="ChEKBWFjb250EghvcmlnaW5hbAoNCgRsYW5nEgVlbi1VUw",YT-EXT-AUDIO-CONTENT-ID="en-US.4",YT-EXT-ABSOLUTE-LOUDNESS=-19.370,DEFAULT=NO,AUTOSELECT=YES`,
  '#EXT-X-STREAM-INF:BANDWIDTH=309872,CODECS="avc1.4D4015,mp4a.40.5",RESOLUTION=426x240,FRAME-RATE=25,VIDEO-RANGE=SDR,YT-EXT-ABSOLUTE-LOUDNESS=-19.370,AUDIO="233",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/229/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=1283076,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=25,VIDEO-RANGE=SDR,YT-EXT-ABSOLUTE-LOUDNESS=-19.370,AUDIO="234",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/232/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=3581454,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=25,VIDEO-RANGE=SDR,YT-EXT-ABSOLUTE-LOUDNESS=-19.370,AUDIO="234",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/270/index.m3u8`,
  "",
].join("\n");

/** Doublages HUMAINS (`acont=dubbed`, identifiant `.3`) à côté de l'originale anglaise. */
export const HUMAN_DUBBED_MASTER = [
  "#EXTM3U",
  "#EXT-X-INDEPENDENT-SEGMENTS",
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed:lang%3Des/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="es",NAME="Español - dubbed",YT-EXT-XTAGS="Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZXM",YT-EXT-AUDIO-CONTENT-ID="es.3",YT-EXT-ABSOLUTE-LOUDNESS=-23.360,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Ddubbed:lang%3Dfr/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="fr",NAME="Français - dubbed",YT-EXT-XTAGS="Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZnI",YT-EXT-AUDIO-CONTENT-ID="fr.3",YT-EXT-ABSOLUTE-LOUDNESS=-20.200,DEFAULT=NO,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/sgoap/itag%3D140%3Bxtags%3Dacont%3Doriginal:lang%3Den/index.m3u8",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="en",NAME="English - original",YT-EXT-XTAGS="ChEKBWFjb250EghvcmlnaW5hbAoKCgRsYW5nEgJlbg",YT-EXT-AUDIO-CONTENT-ID="en.4",YT-EXT-ABSOLUTE-LOUDNESS=-19.880,DEFAULT=NO,AUTOSELECT=YES`,
  '#EXT-X-STREAM-INF:BANDWIDTH=2564756,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=30,VIDEO-RANGE=SDR,YT-EXT-ABSOLUTE-LOUDNESS=-19.880,AUDIO="234",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/232/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=4692245,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=30,VIDEO-RANGE=SDR,YT-EXT-ABSOLUTE-LOUDNESS=-19.880,AUDIO="234",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/270/index.m3u8`,
  "",
].join("\n");

const PLAYBACK = "https://rr5---sn-test.googlevideo.test/videoplayback?expire=1790970374&ip=203.0.113.7&id=o-test&source=youtube";

/** Les URL des formats https d'une extraction (yt-dlp `-j`) : leur `xtags` dit la piste. */
export const audioFormatUrl = (itag: number, xtags?: string) =>
  `${PLAYBACK}&itag=${itag}${xtags ? `&xtags=${xtags}` : ""}&mime=audio%2Fmp4&dur=724.369`;

/** Les formats audio relevés (139, en m4a) : un doublage automatique français, l'originale américaine. */
export const AUTO_DUBBED_AUDIO_URLS = [
  audioFormatUrl(139, "acont%3Ddubbed-auto%3Alang%3Dfr-FR"),
  audioFormatUrl(139, "acont%3Ddubbed-auto%3Alang%3Dde-DE"),
  audioFormatUrl(139, "acont%3Doriginal%3Alang%3Den-US"),
  // Le « DRC » (compression de dynamique) a ses xtags à lui, sans contenu.
  audioFormatUrl(140, "drc%3D1"),
];
