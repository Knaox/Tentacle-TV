/**
 * Libellés lisibles des pistes d'un fichier LOCAL.
 *
 * En ligne, Jellyfin fournit un `DisplayTitle` déjà présentable
 * (« Français - AAC »). Hors ligne il n'y a que la track-list mpv, dont les
 * champs sont bruts : le menu affichait « fr-BE », « en », « Forced », « SDH ».
 * Ce module en fait « Français (Belgique) », « Anglais », « Français — Forced ».
 *
 * La sortie suit la convention de `formatTrackLabel` (« Nom - CODEC ») pour que
 * `parseTrackLabel` de TrackSelector en extraie le badge de codec ; les
 * mentions Forced/SDH sont séparées par un tiret CADRATIN, qui ne collide pas
 * avec le « - » de découpe.
 */

import { primaryLangSubtag } from "../components/player/mpvTrackMapping";

export interface LocalTrackInput {
  lang?: string;
  title?: string;
  codec?: string;
  forced?: boolean;
  /** Malentendants — déduit du nom de side-car, mpv ne l'expose pas. */
  sdh?: boolean;
}

const FORCED_RE = /\bforc(ed|é|ee|ée)s?\b/i;
const SDH_RE = /\b(sdh|cc|hearing[- ]impaired|malentendants?)\b/i;

/** Codecs aux noms d'affichage établis ; sinon la valeur brute si elle a l'air d'un sigle. */
const CODEC_LABELS: Record<string, string> = {
  subrip: "SRT", srt: "SRT", ass: "ASS", ssa: "SSA", webvtt: "VTT", vtt: "VTT",
  mov_text: "TX3G", eac3: "EAC3", ac3: "AC3", aac: "AAC", dts: "DTS",
  truehd: "TrueHD", flac: "FLAC", opus: "Opus", mp3: "MP3", vorbis: "Vorbis",
  pcm_s16le: "PCM", pgs: "PGS", hdmv_pgs_subtitle: "PGS", dvd_subtitle: "VobSub",
};

function codecLabel(codec: string | undefined): string | null {
  if (!codec) return null;
  const known = CODEC_LABELS[codec.toLowerCase()];
  if (known) return known;
  return /^[a-z0-9]{2,8}$/i.test(codec) ? codec.toUpperCase() : null;
}

/** « fr-BE » → « Français (Belgique) », avec repli sur la langue seule puis le code. */
function languageLabel(lang: string | undefined, locale: string): string | null {
  const raw = lang?.trim();
  if (!raw || raw.toLowerCase() === "und") return null;
  // mpv rend des codes ISO 639-2/B (« fre ») qu'Intl ne connaît pas toujours :
  // on repasse d'abord par le sous-tag primaire à 2 lettres.
  const [base, ...rest] = raw.split("-");
  const region = rest.find((part) => /^[a-z]{2}$|^\d{3}$/i.test(part));
  const primary = primaryLangSubtag(base) ?? base;
  const attempts = region ? [`${primary}-${region.toUpperCase()}`, primary] : [primary];
  for (const tag of attempts) {
    try {
      const display = new Intl.DisplayNames([locale], { type: "language" }).of(tag);
      // Intl renvoie le code inchangé quand il ne connaît pas la langue.
      if (display && display.toLowerCase() !== tag.toLowerCase()) return capitalize(display);
    } catch {
      /* tag invalide (RangeError) → candidat suivant */
    }
  }
  return raw.toUpperCase();
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

/**
 * Libellé d'une piste locale. `fallback` sert quand ni langue ni titre
 * exploitable n'existent (typiquement `player:trackFallback`).
 */
export function formatLocalTrackLabel(
  track: LocalTrackInput,
  { locale, fallback }: { locale: string; fallback: string },
): string {
  const title = track.title?.trim() ?? "";
  const isForced = track.forced === true || FORCED_RE.test(title);
  const isSdh = track.sdh === true || SDH_RE.test(title);

  // Un titre qui ne fait que répéter un drapeau (« Forced », « SDH ») n'apporte
  // rien : la mention est déjà rendue à part.
  const meaningfulTitle = title
    .replace(FORCED_RE, "")
    .replace(SDH_RE, "")
    .replace(/[[\]()]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;/·—-]+|[\s,;/·—-]+$/g, "")
    .trim();

  const language = languageLabel(track.lang, locale);
  // Le titre l'emporte quand il est informatif (« Commentaire du réalisateur »)
  // et n'est pas une simple redite du nom de langue.
  const sameAsLanguage =
    !!language && meaningfulTitle.toLowerCase() === language.toLowerCase();
  const base = meaningfulTitle && !sameAsLanguage
    ? (language ? `${language} — ${meaningfulTitle}` : meaningfulTitle)
    : language;

  const flags = [isForced ? "Forced" : null, isSdh ? "SDH" : null].filter(Boolean);
  const name = [base ?? fallback, ...flags].join(" — ");
  const codec = codecLabel(track.codec);
  return codec ? `${name} - ${codec}` : name;
}
