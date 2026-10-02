/* ------------------------------------------------------------------ */
/*  Les listes HLS d'une bande-annonce relayée — fonctions pures       */
/*                                                                     */
/*  Le serveur relaie la bande-annonce au lieu de confier les URL      */
/*  googlevideo au téléviseur : elles sont signées pour l'adresse IP   */
/*  qui a fait l'extraction (`sparams` contient `ip`), et un appareil  */
/*  qui sort par une autre (serveur distant, IPv6) se les voit         */
/*  refuser. Ici, rien que du texte : le maître ne garde que le H.264  */
/*  (que tout Apple TV décode en matériel), sans sous-titres, sa       */
/*  variante de départ en tête ; chaque URI renvoie vers le relais.    */
/* ------------------------------------------------------------------ */

/** Une variante du maître : sa ligne `#EXT-X-STREAM-INF`, son URI amont. */
export interface MasterVariant {
  key: string;
  inf: string;
  upstream: string;
  bandwidth: number;
  height: number;
  /** Le codec vidéo déclaré (`avc1.640028`…), vide si le maître n'en dit rien. */
  video: string;
  audioGroup?: string;
}

/** Une piste audio séparée (`#EXT-X-MEDIA:TYPE=AUDIO`). */
export interface MasterRendition {
  key: string;
  line: string;
  upstream: string;
  group: string;
}

export interface RelayMaster {
  variants: MasterVariant[];
  audio: MasterRendition[];
  /** Les lignes d'en-tête gardées telles quelles (`#EXT-X-INDEPENDENT-SEGMENTS`…). */
  header: string[];
}

/**
 * La hauteur de la variante de départ : AVPlayer commence par la PREMIÈRE
 * variante du maître. YouTube y met la 240p ; partir de la 720p donne une
 * image nette tout de suite, et un premier segment assez petit pour arriver
 * vite (mesuré : première image en 0,5 à 0,9 s, puis 1080p).
 */
export const START_HEIGHT = 720;
/** Au-delà, rien n'est gardé : un téléviseur ne gagnerait rien de plus pour une bande-annonce. */
export const MAX_HEIGHT = 1080;

const HEADER_TAGS = ["#EXT-X-VERSION:", "#EXT-X-INDEPENDENT-SEGMENTS"];

function attribute(line: string, name: string): string | undefined {
  const m = new RegExp(`[:,]${name}=("([^"]*)"|[^,]*)`).exec(line);
  if (!m) return undefined;
  return m[2] ?? m[1];
}

/** Le codec vidéo d'une liste `CODECS` : le premier qui n'est pas de l'audio. */
function videoCodec(codecs: string | undefined): string {
  if (!codecs) return "";
  return codecs.split(",").map((c) => c.trim()).find((c) => !/^(mp4a|ac-3|ec-3|opus|flac)/i.test(c)) ?? "";
}

const isH264 = (codec: string) => codec === "" || /^avc[13]\./i.test(codec);

/** La clé stable d'une URI googlevideo : son itag, le même d'une extraction à l'autre. */
export function itagOf(url: string): string | undefined {
  return /[/?&]itag[/=](\d+)/.exec(url)?.[1];
}

/** Lit un maître et n'en garde que ce qu'un Apple TV lit sans faute. `null` : aucune variante H.264. */
export function parseMaster(text: string, base: string): RelayMaster | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines[0] !== "#EXTM3U" || !lines.some((l) => l.startsWith("#EXT-X-STREAM-INF:"))) return null;
  const header = lines.filter((l) => HEADER_TAGS.some((tag) => l.startsWith(tag)));
  const used = new Set<string>();
  const keyFor = (url: string, fallback: string) => {
    let key = itagOf(url) ?? fallback;
    while (used.has(key)) key = `${key}b`;
    used.add(key);
    return key;
  };

  const variants: MasterVariant[] = [];
  const audio: MasterRendition[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-MEDIA:") && attribute(line, "TYPE") === "AUDIO") {
      const uri = attribute(line, "URI");
      const group = attribute(line, "GROUP-ID");
      if (!uri || !group) continue;
      const upstream = new URL(uri, base).href;
      audio.push({ key: keyFor(upstream, `a${audio.length}`), line, upstream, group });
    } else if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const uri = lines[i + 1];
      if (!uri || uri.startsWith("#")) continue;
      i++;
      const video = videoCodec(attribute(line, "CODECS"));
      const height = Number(/RESOLUTION=\d+x(\d+)/.exec(line)?.[1] ?? 0);
      if (!isH264(video) || height > MAX_HEIGHT) continue;
      const upstream = new URL(uri, base).href;
      variants.push({
        key: keyFor(upstream, `v${variants.length}`),
        // Les sous-titres de YouTube ne sont pas relayés : l'écran n'en montre pas.
        inf: line.replace(/,SUBTITLES="[^"]*"/, "").replace(/,CLOSED-CAPTIONS="[^"]*"/, ""),
        upstream,
        bandwidth: Number(attribute(line, "BANDWIDTH") ?? 0),
        height,
        video,
        audioGroup: attribute(line, "AUDIO"),
      });
    }
  }
  if (!variants.length) return null;
  const groups = new Set(variants.map((v) => v.audioGroup).filter(Boolean));
  return { variants, audio: audio.filter((a) => groups.has(a.group)), header };
}

/** La variante de départ : la plus haute jusqu'à `START_HEIGHT`, sinon la plus basse. */
export function startVariant(variants: MasterVariant[]): MasterVariant {
  const byBandwidth = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  const fitting = byBandwidth.filter((v) => v.height > 0 && v.height <= START_HEIGHT);
  return fitting[fitting.length - 1] ?? byBandwidth[0];
}

/** Le maître servi au téléviseur : la variante de départ en tête, les autres par débit croissant. */
export function renderMaster(master: RelayMaster, uriFor: (key: string) => string): string {
  const start = startVariant(master.variants);
  const rest = master.variants.filter((v) => v !== start).sort((a, b) => a.bandwidth - b.bandwidth);
  const out = ["#EXTM3U", ...master.header];
  for (const a of master.audio) out.push(a.line.replace(/URI="[^"]*"/, `URI="${uriFor(a.key)}"`));
  for (const v of [start, ...rest]) out.push(v.inf, uriFor(v.key));
  return `${out.join("\n")}\n`;
}

/** Une liste de segments relayée : son texte réécrit et les URL amont, dans l'ordre. */
export interface RelayMedia {
  text: string;
  segments: string[];
  /** Le segment d'initialisation (`#EXT-X-MAP`, fMP4), s'il y en a un. */
  init?: string;
}

/**
 * Réécrit une liste de segments : chaque segment et l'éventuel segment
 * d'initialisation pointent vers le relais. `null` : ce n'est pas une liste
 * de segments (un maître, une page d'erreur).
 */
export function rewriteMedia(
  text: string,
  base: string,
  segmentUri: (index: number) => string,
  initUri: () => string,
): RelayMedia | null {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "#EXTM3U" || !lines.some((l) => l.startsWith("#EXTINF"))) return null;
  const segments: string[] = [];
  let init: string | undefined;
  const out = lines.map((raw) => {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-MAP:")) {
      const uri = attribute(line, "URI");
      if (!uri) return line;
      init = new URL(uri, base).href;
      return line.replace(/URI="[^"]*"/, `URI="${initUri()}"`);
    }
    if (!line || line.startsWith("#")) return line;
    segments.push(new URL(line, base).href);
    return segmentUri(segments.length - 1);
  });
  return { text: `${out.join("\n").trimEnd()}\n`, segments, init };
}
