/**
 * Le libellé d'une piste tel que Jellyfin le compose (`DisplayTitle` :
 * « English - SUBRIP - External », « Français - Dolby Digital+ - 5.1 - Par
 * défaut », parfois « … (AC3) ») dit en deux lignes, comme le lecteur d'Apple :
 * la langue (ou le nom) en titre, le format et les drapeaux en détail, avec
 * des noms qu'un humain lit — « SRT », « Dolby Digital », « Externe » —, plus
 * des codes de codec en capitales. Règle PARTAGÉE : les panneaux du lecteur de
 * l'app mobile et les menus du lecteur du web étroit (le miroir) la lisent.
 */
export interface TrackWords {
  default: string;
  forced: string;
  external: string;
}

export interface TrackDescription {
  title: string;
  detail?: string;
}

const CODEC_NAMES: Record<string, string> = {
  SUBRIP: "SRT", SRT: "SRT", ASS: "ASS", SSA: "SSA", PGSSUB: "PGS", PGS: "PGS",
  DVDSUB: "VobSub", DVBSUB: "DVB", WEBVTT: "WebVTT", VTT: "WebVTT",
  AC3: "Dolby Digital", EAC3: "Dolby Digital+", TRUEHD: "Dolby TrueHD",
  DTS: "DTS", AAC: "AAC", FLAC: "FLAC", OPUS: "Opus", MP3: "MP3", VORBIS: "Vorbis",
};

function flagWord(part: string, words: TrackWords): string | null {
  switch (part.toLowerCase()) {
    case "default": return words.default;
    case "forced": return words.forced;
    case "external": return words.external;
    default: return null;
  }
}

/**
 * `[libellé, codec]` d'un libellé qui finit par « (CODEC) » ; `null` sinon. Comme `/^(.*?)\s*\((\w+)\)$/`, sans
 * son temps quadratique sur une longue suite d'espaces (js/polynomial-redos) : le libellé s'arrête aux espaces
 * qui précèdent la parenthèse, et ne passe jamais une fin de ligne (le « . » de l'ancienne expression).
 */
export function trailingCodec(label: string): [string, string] | null {
  const codec = /\(([A-Za-z0-9_]+)\)$/.exec(label);
  if (!codec) return null;
  const head = label.slice(0, codec.index).trimEnd();
  return /[\n\r\u2028\u2029]/.test(head) ? null : [head, codec[1]];
}

export function describeTrack(label: string, words: TrackWords): TrackDescription {
  // « … - Par défaut (AC3) » : le codec que `formatTrackLabel` ajoute en fin de libellé.
  const paren = trailingCodec(label.trim());
  const parts = (paren ? paren[0] : label).split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { title: label };
  const title = parts[0];
  const rest = [...parts.slice(1), ...(paren ? [paren[1]] : [])];
  const seen = new Set<string>();
  const detail = rest
    .map((part) => CODEC_NAMES[part.toUpperCase()] ?? flagWord(part, words) ?? part)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { title: title || label, detail: detail.length > 0 ? detail.join(" · ") : undefined };
}
