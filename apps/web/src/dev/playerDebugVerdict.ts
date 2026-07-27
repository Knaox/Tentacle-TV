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

/** Une ligne de verdict. `bon` colore : vrai = vert, faux = rouge, null = neutre. */
export interface Verdict {
  cle: string;
  valeur: string;
  bon: boolean | null;
}

/** Propriétés nécessaires aux verdicts, lues en une passe. */
export const PROPS_VERDICT = [
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

type Lues = Readonly<Record<string, string | null>>;

const HDR = new Set(["pq", "hlg"]);

/** Nombre lisible, ou `null` si la propriété est absente. */
function nombre(v: string | null | undefined): number | null {
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
function verdictHdr(p: Lues, ecranEnHdr: boolean): Verdict {
  const gamma = p["video-params/gamma"];
  const sortie = p["video-target-params/gamma"];
  const contenuHdr = gamma !== null && gamma !== undefined && HDR.has(gamma);

  if (!contenuHdr) {
    return {
      cle: "HDR",
      valeur: `contenu SDR (${gamma ?? "?"}) — rien a transmettre`,
      bon: null,
    };
  }
  // Sortie inconnue : mpv n'a pas encore configuré sa cible. On ne conclut pas.
  if (sortie === null || sortie === undefined) {
    return { cle: "HDR", valeur: `contenu ${gamma}, sortie pas encore etablie`, bon: null };
  }
  if (!HDR.has(sortie)) {
    return { cle: "HDR", valeur: `contenu ${gamma} → sortie ${sortie} — TONE-MAPPE`, bon: false };
  }
  if (!ecranEnHdr) {
    return { cle: "HDR", valeur: `signal ${sortie} vers un ecran SDR — image sombre`, bon: false };
  }
  const primaires = p["video-target-params/primaries"] ?? "?";
  const pic = nombre(p["video-target-params/sig-peak"]) ?? nombre(p["target-peak"]);
  return {
    cle: "HDR",
    valeur: `REEL — ${sortie} / ${primaires} vers un ecran en HDR${pic ? `, pic ${pic}` : ""}`,
    bon: true,
  };
}

/** Direct play ou transcodage : le `.m3u8` trahit le second. */
function verdictSource(p: Lues): Verdict {
  const chemin = p["path"] ?? "";
  const transcode = chemin.includes(".m3u8");
  return {
    cle: "Source",
    valeur: transcode ? "TRANSCODE (HLS) — la chaine HDR est perdue" : "lecture directe",
    bon: !transcode,
  };
}

/** Dernier segment d'un chemin, séparateur Windows compris. */
function nomDeFichier(chemin: string): string {
  const morceaux = chemin.split(/[\\/]/);
  return morceaux[morceaux.length - 1] ?? "";
}

function hote(chemin: string): string {
  try {
    return new URL(chemin).host;
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
function debitLisible(brut: string | null | undefined): string {
  if (brut === null || brut === undefined || brut === "") return "debit inconnu";
  const octets = Number(brut);
  if (!Number.isFinite(octets)) return brut;
  if (octets <= 0) return "0 o/s";
  return octets >= 1_000_000
    ? `${(octets / 1_000_000).toFixed(1)} Mo/s`
    : `${Math.round(octets / 1000)} ko/s`;
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
function verdictFlux(p: Lues): Verdict {
  const chemin = p["path"] ?? "";
  const via = p["demuxer-via-network"];
  const reseau =
    via === null || via === undefined || via === ""
      ? /^[a-z][a-z0-9+.-]*:\/\//i.test(chemin)
      : via === "yes";

  const ou = reseau ? hote(chemin) : nomDeFichier(chemin);
  const debit = debitLisible(p["cache-speed"]);
  return {
    cle: "Flux",
    valeur: `${reseau ? "RESEAU" : "LOCAL"}${ou === "" ? "" : ` — ${ou}`} · ${debit}`,
    // Ni l'un ni l'autre n'est un défaut : en ligne on lit le serveur, hors
    // ligne le disque. C'est à la lecture de dire si c'est celui qu'on attend.
    bon: null,
  };
}

function verdictDecodage(p: Lues): Verdict {
  const hw = p["hwdec-current"];
  const materiel = hw !== null && hw !== undefined && hw !== "no" && hw !== "";
  return {
    cle: "Decodage",
    valeur: materiel ? `materiel (${hw})` : "LOGICIEL — le processeur decode",
    bon: materiel,
  };
}

/**
 * L'image telle qu'elle est DANS LE FICHIER, avec son rapport.
 *
 * ⚠️ Ces dimensions ne suivent PAS la fenêtre, et c'est voulu : elles répondent
 * à « qu'est-ce qu'on m'envoie », pas à « quelle taille fait la fenêtre ». Un
 * film en scope fait 3840x1604 dans le fichier — 2.39:1 — et les bandes noires
 * n'y sont pas : elles sont ajoutées à l'affichage sur un écran 16:9. Voir
 * `verdictSurface` pour ce qui bouge, lui.
 */
function verdictImage(p: Lues): Verdict {
  const l = nombre(p["dwidth"]) ?? nombre(p["video-params/w"]);
  const h = nombre(p["dheight"]) ?? nombre(p["video-params/h"]);
  const codec = p["video-codec"] ?? "?";
  const debit = nombre(p["video-bitrate"]);
  const mbps = debit === null ? "" : ` — ${(debit / 1_000_000).toFixed(1)} Mb/s`;
  const rapport = l && h ? ` (${(l / h).toFixed(2)}:1)` : "";
  return {
    cle: "Image",
    valeur: l && h ? `${l}x${h}${rapport} ${codec}${mbps}` : `${codec}${mbps}`,
    bon: null,
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
function verdictSurface(p: Lues): Verdict {
  const sl = nombre(p["osd-width"]);
  const sh = nombre(p["osd-height"]);
  if (!sl || !sh) return { cle: "Surface", valeur: "pas encore etablie", bon: null };
  const vl = nombre(p["dwidth"]) ?? nombre(p["video-params/w"]);
  const vh = nombre(p["dheight"]) ?? nombre(p["video-params/h"]);
  if (!vl || !vh) return { cle: "Surface", valeur: `${sl}x${sh}`, bon: null };
  const rapport = vl / vh;
  const affichee = { l: Math.min(sl, Math.round(sh * rapport)), h: Math.min(sh, Math.round(sl / rapport)) };
  const bandes = Math.round((sh - affichee.h) / 2);
  const detail = bandes > 0 ? `, bandes ${bandes} px` : ", plein cadre";
  return {
    cle: "Surface",
    valeur: `${sl}x${sh} — image ${affichee.l}x${affichee.h}${detail}`,
    bon: null,
  };
}

/**
 * Cadence et images perdues.
 *
 * `frame-drop-count` est ce que la sortie vidéo jette faute de temps ;
 * `decoder-frame-drop-count` est ce que le décodeur abandonne. Les deux doivent
 * rester à zéro — une seule image perdue par minute se voit sur un travelling.
 */
function verdictCadence(p: Lues): Verdict {
  const source = nombre(p["container-fps"]);
  const rendu = nombre(p["estimated-vf-fps"]);
  const ecran = nombre(p["display-fps"]);
  const perduesVo = nombre(p["frame-drop-count"]) ?? 0;
  const perduesDec = nombre(p["decoder-frame-drop-count"]) ?? 0;
  const perdues = perduesVo + perduesDec;
  const cadence = [
    source === null ? null : `source ${source.toFixed(3)}`,
    rendu === null ? null : `rendu ${rendu.toFixed(1)}`,
    ecran === null ? null : `ecran ${ecran.toFixed(0)}`,
  ].filter((x): x is string => x !== null).join(" · ");
  return {
    cle: "Cadence",
    valeur: `${cadence}${perdues > 0 ? ` — ${perdues} IMAGES PERDUES` : " — 0 perdue"}`,
    bon: perdues === 0,
  };
}

/** Les verdicts, dans l'ordre où ils comptent. */
export function verdicts(p: Lues, ecranEnHdr: boolean): Verdict[] {
  return [
    verdictSource(p),
    verdictFlux(p),
    verdictHdr(p, ecranEnHdr),
    verdictImage(p),
    verdictSurface(p),
    verdictDecodage(p),
    verdictCadence(p),
  ];
}
