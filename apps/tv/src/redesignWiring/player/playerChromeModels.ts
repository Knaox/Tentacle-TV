import { extractMediaQuality, formatEpisodeCode, type MediaItem, type PlayerOverlay } from "@tentacle-tv/shared";
import type { MetaItem } from "../../redesign/hero/MetaLine";
import { nextCountdownLabel, skipPillLabel, type Translate } from "../../redesign/screens/player/playerLabels";
import type {
  EndScreenModel,
  FrameImage,
  PlayerMedia,
  PlayerPhase,
  ScrubModel,
  SkipPillModel,
  UpNextModel,
} from "../../redesign/screens/player/playerTypes";
import { plainText } from "./playerArt";

/**
 * L'état du lecteur, projeté dans le contrat de l'habillage refondu
 * (`PlayerChromeView`). Des fonctions pures : rien n'y est lu ni décidé —
 * l'arbitre partagé tranche les surimpressions, les hooks du lecteur tiennent
 * l'état ; ici, on les TRADUIT.
 */

/** « S1 · E3 », ou rien quand Jellyfin ne numérote pas l'épisode. */
export function episodeCodeOf(item: MediaItem): string | undefined {
  if (item.ParentIndexNumber == null || item.IndexNumber == null) return undefined;
  return formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber);
}

/** Les pastilles de la source : définition, dynamique, son. */
function sourceBadges(item: MediaItem): MetaItem[] {
  const quality = extractMediaQuality(item);
  const badges: MetaItem[] = [];
  if (quality.resolution === "4K") badges.push({ badge: "4K", strong: true });
  if (quality.isDolbyVision) badges.push({ badge: "Dolby Vision" });
  else if (quality.isHDR) badges.push({ badge: "HDR" });
  if (quality.isDolbyAtmos) badges.push({ badge: "Atmos" });
  else if (quality.surroundLabel) badges.push({ badge: quality.surroundLabel });
  return badges;
}

/**
 * Ce qu'on regarde. Les pastilles de la source ne se montrent que si c'est
 * bien ELLE qui joue (lecture directe) : un transcodage en 1080p d'un fichier
 * 4K HDR ne porte ni « 4K » ni « HDR ».
 */
export function buildPlayerMedia(
  item: MediaItem,
  art: { logoUri?: string; backdropUri?: string },
  sourcePlaying: boolean,
): PlayerMedia {
  const episode = item.Type === "Episode";
  const code = episode ? episodeCodeOf(item) : undefined;
  return {
    title: (episode ? item.SeriesName : undefined) ?? item.Name ?? "",
    logoUri: art.logoUri,
    subtitle: episode ? (code ? `${code} · ${item.Name ?? ""}` : item.Name) : undefined,
    backdropUri: art.backdropUri,
    badges: sourcePlaying ? sourceBadges(item) : undefined,
  };
}

/** L'ouverture : résolution du flux (jalon PrismCore), première image, lecture. */
export function buildPhase(args: {
  streamUrl: string | null;
  failed: boolean;
  hasStarted: boolean;
  videoError: string | null;
  step: { label: string; index: number; count: number } | null;
  t: Translate;
}): PlayerPhase {
  if (!args.streamUrl) {
    return args.failed ? { kind: "failed", message: args.t("player:loadFailed") } : { kind: "resolving", step: args.step };
  }
  // Une erreur avant la première image n'enferme pas sous l'écran de
  // chargement : le bandeau la dit, par-dessus l'habillage (comme avant).
  if (!args.hasStarted && !args.videoError) return { kind: "starting" };
  return { kind: "playing" };
}

/**
 * La pilule de saut, d'après l'arbitre partagé : un passage à sauter
 * (`skip`) ou la suite à rejoindre (`nextButton`). Le décompte se mesure sur
 * la durée RÉELLE du minuteur (`countdownTotals`), pas sur dix secondes.
 */
export function buildSkipPill(overlay: PlayerOverlay, t: Translate, skipTotalMs: number): SkipPillModel | null {
  if (overlay.kind === "nextButton") {
    return { kind: "next", label: skipPillLabel(t, "goToNextEpisode", null), countdown: null, refusable: false };
  }
  if (overlay.kind !== "skip") return null;
  const remaining = overlay.countdownSeconds;
  const action = overlay.action.kind;
  return {
    kind: action === "endOfPlayback" ? "end" : action === "nextEpisode" ? "next" : "segment",
    label: skipPillLabel(t, overlay.labelKey, remaining),
    countdown: remaining !== null ? { remaining, total: Math.max(remaining, skipTotalMs / 1000) } : null,
    // Le refus suit le caractère AUTOMATIQUE du passage, tant qu'il n'est pas
    // déjà en sourdine — même règle que le bouton actuel.
    refusable: overlay.auto && overlay.dismissible,
  };
}

/**
 * La carte « À suivre » du générique. Le décompte ne s'annonce que si la
 * suite part VRAIMENT toute seule : minuteur réglé mais lecture auto éteinte,
 * il irait au bout sans rien lancer — ni échéance, ni anneau, une simple
 * proposition.
 */
export function buildUpNext(args: {
  next: MediaItem;
  imageUri?: string;
  countdownSeconds: number | null;
  autoPlay: boolean;
  nextTotalMs: number;
  t: Translate;
}): UpNextModel {
  const { next, countdownSeconds, t } = args;
  const timed = args.autoPlay && countdownSeconds !== null;
  return {
    imageUri: args.imageUri,
    code: episodeCodeOf(next),
    title: next.Name ?? "",
    overview: plainText(next.Overview),
    countdownLabel: timed ? nextCountdownLabel(t, countdownSeconds) : undefined,
    countdown: timed ? { remaining: countdownSeconds, total: Math.max(countdownSeconds, args.nextTotalMs / 1000) } : null,
  };
}

/** L'affiche de la vraie fin : la carte, plus la série qui l'entoure. */
export function buildEndScreen(
  upNext: UpNextModel,
  series: { title: string; logoUri?: string; backdropUri?: string; palette: EndScreenModel["palette"] },
): EndScreenModel {
  return { ...upNext, seriesTitle: series.title, logoUri: series.logoUri, backdropUri: series.backdropUri, palette: series.palette };
}

/**
 * La vitesse du défilement, lue sur le libellé du moteur partagé : « >>4x »
 * (maintien d'une touche, `useScrubController`) ou « ▶▶ 4x » (glissé de la
 * Siri Remote, `useScrubGestures.ios`). Un libellé inconnu ne montre rien.
 */
const SPEED = /^(>>|<<|▶▶|◀◀)\s*(\d+(?:\.\d+)?)x$/;

export function parseSpeedLabel(label: string | null | undefined): ScrubModel["speed"] {
  const match = label ? SPEED.exec(label.trim()) : null;
  if (!match) return null;
  return { factor: Number(match[2]), backward: match[1] === "<<" || match[1] === "◀◀" };
}

/** Une case de planche trickplay → l'image plein cadre de la vue. */
export function trickplayFrame(
  info: { Width: number; Height: number; TileWidth: number; TileHeight: number } | null | undefined,
  frame: { url: string; xInTile: number; yInTile: number } | null | undefined,
): FrameImage | null {
  if (!info || !frame) return null;
  return {
    uri: frame.url,
    crop: {
      x: frame.xInTile,
      y: frame.yInTile,
      width: info.Width,
      height: info.Height,
      sheetWidth: info.Width * info.TileWidth,
      sheetHeight: info.Height * info.TileHeight,
    },
  };
}
