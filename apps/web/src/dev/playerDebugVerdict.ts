/**
 * Verdicts en clair : ce que le lecteur affiche VRAIMENT.
 *
 * DÉVELOPPEMENT UNIQUEMENT — `__PLAYER_DEBUG__` est faux dans tout build livré,
 * ce module disparaît alors du bundle. D'où les libellés en clair, sans i18n.
 *
 * Le reste du panneau montre des propriétés brutes ; ici on répond aux cinq
 * questions qu'on se pose réellement devant l'écran, et auxquelles aucune
 * propriété ne répond seule :
 *
 *  - est-ce que le flux est direct, ou transcodé ?
 *  - les octets viennent-ils du DISQUE ou du RÉSEAU, et à quel débit ?
 *  - est-ce du VRAI HDR, ou du tone-mapping qui en a l'air ?
 *  - le décodage est-il matériel ?
 *  - est-ce que ça tient la cadence ?
 *
 * Une capture d'écran ne peut pas y répondre : sur un écran HDR elle est
 * ramenée en SDR. Ces lignes-ci, si.
 */

/** Une ligne de verdict. `good` colore : vrai = vert, faux = rouge, null = neutre. */
export interface Verdict {
  key: string;
  value: string;
  good: boolean | null;
}

/** Propriétés nécessaires aux verdicts, lues en une passe. */
export const VERDICT_PROPS = [
  "path",
  "video-params/gamma",
  "video-params/primaries",
  "video-params/sig-peak",
  "video-params/w",
  "video-params/h",
  // ⚠️ CE sont les valeurs effectives, celles qui partent vers l'écran après
  // conversion. Les réglages `target-*` ne disent que ce qu'on a DEMANDÉ, et
  // valent « auto » en fonctionnement normal — les lire comme une sortie fait
  // conclure à un tone-mapping sur une image parfaitement HDR.
  "video-target-params/gamma",
  "video-target-params/primaries",
  "video-target-params/sig-peak",
  "target-peak",
  "tone-mapping",
  // D'où viennent les octets, et à quelle vitesse ils entrent.
  "demuxer-via-network",
  "cache-speed",
  "hwdec-current",
  "video-codec",
  "video-bitrate",
  "container-fps",
  "estimated-vf-fps",
  "display-fps",
  "frame-drop-count",
  "decoder-frame-drop-count",
  "dwidth",
  "dheight",
  // Surface de dessin de mpv — la seule de ces valeurs qui suive la fenêtre.
  "osd-width",
  "osd-height",
] as const;

type ReadProps = Readonly<Record<string, string | null>>;

const HDR = new Set(["pq", "hlg"]);

/** Nombre lisible, ou `null` si la propriété est absente. */
function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Le HDR est-il RÉEL ?
 *
 * Trois conditions, et il faut les trois : le contenu en PQ ou HLG, la sortie
 * EFFECTIVE de mpv en PQ ou HLG, et l'écran réellement basculé en mode HDR.
 *
 * ⚠️ La sortie effective se lit dans `video-target-params/gamma`, jamais dans
 * `target-trc`. Ce dernier est le RÉGLAGE — il vaut « auto » en fonctionnement
 * normal, ce qui ne veut pas dire « pas de HDR » mais « mpv décide d'après
 * l'écran ». Le lire comme une sortie faisait annoncer un tone-mapping sur une
 * image parfaitement HDR, écran basculé et Dolby Vision à l'appui.
 *
 * Le piège inverse est réel aussi : quand Jellyfin transcode, la chaîne HDR est
 * détruite avant que mpv ne la voie et le contenu arrive en `bt.1886`. Le
 * lecteur se comporte bien, il n'y a simplement plus de HDR à transmettre.
 */
function hdrVerdict(p: ReadProps, screenInHdr: boolean, coucheHdr?: boolean | null): Verdict {
  const gamma = p["video-params/gamma"];
  const output = p["video-target-params/gamma"];
  const hdrContent = gamma !== null && gamma !== undefined && HDR.has(gamma);

  if (!hdrContent) {
    return {
      key: "HDR",
      value: `contenu SDR (${gamma ?? "?"}) — rien a transmettre`,
      good: null,
    };
  }
  // Sortie inconnue. Deux cas, et ils ne se concluent pas pareil.
  if (output === null || output === undefined) {
    // ⚠️ Avec `vo=libmpv` — le rendu dans une vue à nous — mpv n'expose PAS
    // `video-target-params` : il n'a pas de cible à décrire, c'est l'hôte qui
    // présente. La plage étendue accordée par le compositeur est alors la seule
    // preuve disponible, et elle en est une : rien ne l'obtient sans contenu
    // au-delà du blanc SDR.
    if (screenInHdr) {
      return { key: "HDR", value: `REEL — contenu ${gamma}, plage etendue accordee`, good: true };
    }
    return { key: "HDR", value: `contenu ${gamma}, sortie pas encore etablie`, good: null };
  }
  if (!HDR.has(output)) {
    return { key: "HDR", value: `contenu ${gamma} → sortie ${output} — TONE-MAPPE`, good: false };
  }
  const primaries = p["video-target-params/primaries"] ?? "?";
  const pic = toNumber(p["video-target-params/sig-peak"]) ?? toNumber(p["target-peak"]);
  const detail = `${output} / ${primaries}${pic ? `, pic ${pic}` : ""}`;

  // ⚠️ Sur macOS, `screenInHdr` est un EDR INSTANTANÉ qui dépend de l'image :
  // une scène de nuit ne réclame aucune haute lumière et le fait retomber à
  // 1,00 sur une lecture parfaitement HDR. Mesuré sur le même film, à quelques
  // minutes d'intervalle : 1,00 puis 12,82. S'y fier seul faisait annoncer
  // « vers un ecran SDR » pendant qu'une couche ITUR_2100_PQ était active — le
  // diagnostic accusait alors l'écran d'un défaut qui n'existait pas.
  //
  // `coucheHdr` vient de mpv lui-même, qui trace l'état de sa couche Metal.
  // C'est le RENDU qui parle, et il ne dépend pas de la scène.
  if (coucheHdr === true) {
    return { key: "HDR", value: `REEL — ${detail}, couche en plage etendue`, good: true };
  }
  if (!screenInHdr) {
    // `coucheHdr` à `null` veut dire « on ne sait pas », jamais « non » : la
    // coquille qui répond ne suit pas forcément l'état de la couche.
    const cause = coucheHdr === false
      ? "couche en SDR"
      : "aucune plage etendue accordee EN CE MOMENT — scene sombre ?";
    return { key: "HDR", value: `signal ${output} — ${cause}`, good: false };
  }
  return { key: "HDR", value: `REEL — ${detail} vers un ecran en HDR`, good: true };
}

/** Direct play ou transcodage : le `.m3u8` trahit le second. */
function sourceVerdict(p: ReadProps): Verdict {
  const path = p["path"] ?? "";
  const transcoded = path.includes(".m3u8");
  return {
    key: "Source",
    value: transcoded ? "TRANSCODE (HLS) — la chaine HDR est perdue" : "lecture directe",
    good: !transcoded,
  };
}

/** Dernier segment d'un chemin, séparateur Windows compris. */
function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? "";
}

function host(path: string): string {
  try {
    return new URL(path).host;
  } catch {
    return "";
  }
}

/**
 * Débit d'entrée, quelle que soit la forme rendue par mpv.
 *
 * ⚠️ `cache-speed` est un entier d'octets par seconde, mais mpv lui donne une
 * représentation TEXTE déjà lisible (« 5.3 MiB/s ») — et c'est ce qu'on reçoit,
 * `mpv_get_property_string` rendant la forme d'affichage quand la propriété en
 * définit une. On formate donc nous-mêmes si c'est un nombre, et on relaie tel
 * quel sinon. Les deux builds de libmpv sont ainsi couverts.
 */
function readableBitrate(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "debit inconnu";
  const bytes = Number(raw);
  if (!Number.isFinite(bytes)) return raw;
  if (bytes <= 0) return "0 o/s";
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} Mo/s`
    : `${Math.round(bytes / 1000)} ko/s`;
}

/**
 * D'où viennent réellement les octets : le disque, ou le réseau ?
 *
 * C'est LA question du mode hors ligne, et aucune autre ligne n'y répond :
 * « lecture directe » distingue le direct du transcodage, pas le local du
 * distant. Un film téléchargé qui se lirait quand même depuis le serveur
 * passerait donc totalement inaperçu — et c'est précisément le bug qu'on ne
 * verrait jamais, puisque l'image serait parfaite.
 *
 * `demuxer-via-network` fait autorité : mpv sait ce qu'il a ouvert. Le schéma
 * du chemin ne sert que de repli, pour un libmpv qui ne rendrait pas la
 * propriété.
 */
function streamVerdict(p: ReadProps): Verdict {
  const path = p["path"] ?? "";
  const via = p["demuxer-via-network"];
  const network =
    via === null || via === undefined || via === ""
      ? /^[a-z][a-z0-9+.-]*:\/\//i.test(path)
      : via === "yes";

  const ou = network ? host(path) : fileName(path);
  const bitrate = readableBitrate(p["cache-speed"]);
  return {
    key: "Flux",
    value: `${network ? "RESEAU" : "LOCAL"}${ou === "" ? "" : ` — ${ou}`} · ${bitrate}`,
    // Ni l'un ni l'autre n'est un défaut : en ligne on lit le serveur, hors
    // ligne le disque. C'est à la lecture de dire si c'est celui qu'on attend.
    good: null,
  };
}

function decodeVerdict(p: ReadProps): Verdict {
  const hw = p["hwdec-current"];
  const hardware = hw !== null && hw !== undefined && hw !== "no" && hw !== "";
  return {
    key: "Decodage",
    value: hardware ? `materiel (${hw})` : "LOGICIEL — le processeur decode",
    good: hardware,
  };
}

/**
 * L'image telle qu'elle est DANS LE FICHIER, avec son rapport.
 *
 * ⚠️ Ces dimensions ne suivent PAS la fenêtre, et c'est voulu : elles répondent
 * à « qu'est-ce qu'on m'envoie », pas à « quelle taille fait la fenêtre ». Un
 * film en scope fait 3840x1604 dans le fichier — 2.39:1 — et les bandes noires
 * n'y sont pas : elles sont ajoutées à l'affichage sur un écran 16:9. Voir
 * `surfaceVerdict` pour ce qui bouge, lui.
 */
function imageVerdict(p: ReadProps): Verdict {
  const l = toNumber(p["dwidth"]) ?? toNumber(p["video-params/w"]);
  const h = toNumber(p["dheight"]) ?? toNumber(p["video-params/h"]);
  const codec = p["video-codec"] ?? "?";
  const bitrate = toNumber(p["video-bitrate"]);
  const mbps = bitrate === null ? "" : ` — ${(bitrate / 1_000_000).toFixed(1)} Mb/s`;
  const ratio = l && h ? ` (${(l / h).toFixed(2)}:1)` : "";
  return {
    key: "Image",
    value: l && h ? `${l}x${h}${ratio} ${codec}${mbps}` : `${codec}${mbps}`,
    good: null,
  };
}

/**
 * La surface où mpv dessine, et les bandes qu'elle impose.
 *
 * C'est la valeur qui SUIT la fenêtre : elle passe à la taille de l'écran en
 * plein écran, et le panneau la rafraîchit toutes les 500 ms. Les bandes se
 * déduisent du rapport — une image en 2.39:1 sur une surface 16:9 en laisse
 * forcément.
 */
function surfaceVerdict(p: ReadProps): Verdict {
  const sl = toNumber(p["osd-width"]);
  const sh = toNumber(p["osd-height"]);
  if (!sl || !sh) return { key: "Surface", value: "pas encore etablie", good: null };
  const vl = toNumber(p["dwidth"]) ?? toNumber(p["video-params/w"]);
  const vh = toNumber(p["dheight"]) ?? toNumber(p["video-params/h"]);
  if (!vl || !vh) return { key: "Surface", value: `${sl}x${sh}`, good: null };
  const ratio = vl / vh;
  const displayed = { l: Math.min(sl, Math.round(sh * ratio)), h: Math.min(sh, Math.round(sl / ratio)) };
  const bars = Math.round((sh - displayed.h) / 2);
  const detail = bars > 0 ? `, bandes ${bars} px` : ", plein cadre";
  return {
    key: "Surface",
    value: `${sl}x${sh} — image ${displayed.l}x${displayed.h}${detail}`,
    good: null,
  };
}

/**
 * Cadence et images perdues.
 *
 * `frame-drop-count` est ce que la sortie vidéo jette faute de temps ;
 * `decoder-frame-drop-count` est ce que le décodeur abandonne. Les deux doivent
 * rester à zéro — une seule image perdue par minute se voit sur un travelling.
 */
function framerateVerdict(p: ReadProps): Verdict {
  const source = toNumber(p["container-fps"]);
  const rendered = toNumber(p["estimated-vf-fps"]);
  const screen = toNumber(p["display-fps"]);
  const droppedVo = toNumber(p["frame-drop-count"]) ?? 0;
  const droppedDec = toNumber(p["decoder-frame-drop-count"]) ?? 0;
  const dropped = droppedVo + droppedDec;
  const cadence = [
    source === null ? null : `source ${source.toFixed(3)}`,
    rendered === null ? null : `rendu ${rendered.toFixed(1)}`,
    screen === null ? null : `ecran ${screen.toFixed(0)}`,
  ].filter((x): x is string => x !== null).join(" · ");
  return {
    key: "Cadence",
    value: `${cadence}${dropped > 0 ? ` — ${dropped} IMAGES PERDUES` : " — 0 perdue"}`,
    good: dropped === 0,
  };
}

/**
 * Les verdicts, dans l'ordre où ils comptent.
 *
 * `coucheHdr` n'existe que sur la coquille Electron macOS, où l'EDR seul ne
 * suffit pas à juger — voir `hdrVerdict`. Absent ailleurs, et absent ne veut
 * pas dire « non ».
 */
export function verdicts(p: ReadProps, screenInHdr: boolean, coucheHdr?: boolean | null): Verdict[] {
  return [
    sourceVerdict(p),
    streamVerdict(p),
    hdrVerdict(p, screenInHdr, coucheHdr),
    imageVerdict(p),
    surfaceVerdict(p),
    decodeVerdict(p),
    framerateVerdict(p),
  ];
}
