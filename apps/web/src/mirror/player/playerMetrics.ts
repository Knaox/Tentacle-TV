/**
 * Les mesures et petites règles du lecteur de l'app, en fonctions pures —
 * recopiées de `MobilePlayerOverlay`, `PlayerSeekBar`, `PlayerGestures` et
 * `lib/playerUtils.ts`. Une mesure changée dans l'app se change ici.
 */

/** Échelle des contrôles : 1,4 sur tablette (lecteur iPad), 1 au téléphone. */
export function playerUiScale(isTablet: boolean): number {
  return isTablet ? 1.4 : 1;
}

/** Le bouton lecture : `min(92 | 60, 0,08 × H)`. */
export function playButtonSize(isTablet: boolean, screenH: number): number {
  return Math.min(isTablet ? 92 : 60, Math.round(screenH * 0.08));
}

/** L'écart de la rangée centrale : `min(76 | 36, 0,05 × W)`. */
export function centerGap(isTablet: boolean, screenW: number): number {
  return Math.min(isTablet ? 76 : 36, Math.round(screenW * 0.05));
}

/** Les sauts des boutons et du double-tap : −10 / +30 s. */
export const SKIP_BACK_SECONDS = 10;
export const SKIP_FORWARD_SECONDS = 30;

/** L'habillage s'efface après 4 s de lecture, en fondu de 300 ms. */
export const AUTO_HIDE_MS = 4000;
export const FADE_MS = 300;

/** Barre de progression : 4 (6 en glissé), ×1,6 sur tablette ; pouce 14 / 20. */
export function trackHeight(dragging: boolean, isTablet: boolean): number {
  return (dragging ? 6 : 4) * (isTablet ? 1.6 : 1);
}
export function thumbSize(isTablet: boolean): number {
  return isTablet ? 20 : 14;
}

/** « 1:02:03 » / « 4:05 » — le format de `PlayerSeekBar`. */
export function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Fraction 0-1 sous le doigt, bornée à la barre. */
export function pctAt(x: number, width: number): number {
  if (width <= 0) return 0;
  return Math.max(0, Math.min(1, x / width));
}

/** Le côté d'un tap pour le double-tap (`PlayerGestures`) : 35 % / 65 %. */
export type TapSide = "left" | "right" | "center";
export function tapSide(x: number, screenW: number): TapSide {
  if (x < screenW * 0.35) return "left";
  if (x > screenW * 0.65) return "right";
  return "center";
}

/** Balayage vers le bas pour quitter : > 100 px, plus vertical qu'horizontal. */
export function isSwipeDown(dx: number, dy: number): boolean {
  return dy > 100 && Math.abs(dx) < dy;
}

/** « S01E02 » d'un épisode, ou `null`. */
export function episodeCode(season: number | null | undefined, episode: number | null | undefined): string | null {
  if (season == null || episode == null) return null;
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

/**
 * Libellé de piste → titre propre, pastille de langue, pastille de codec —
 * `parseTrackLabel` de `lib/playerUtils.ts` de l'app.
 */
export function parseTrackLabel(raw: string): { title: string; lang: string | null; codec: string | null } {
  const parts = raw.split(" - ");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const isCodec = /^[A-Z0-9]{2,8}$/i.test(last);
    return {
      title: parts.slice(0, isCodec ? -1 : undefined).join(" - "),
      codec: isCodec ? last : null,
      lang: extractLang(parts[0]),
    };
  }
  return { title: raw, codec: null, lang: extractLang(raw) };
}

const LANG_MAP: Record<string, string> = {
  french: "FR", français: "FR", francais: "FR", fre: "FR", fra: "FR",
  english: "EN", anglais: "EN", eng: "EN",
  japanese: "JP", japonais: "JP", jpn: "JP",
  german: "DE", allemand: "DE", ger: "DE", deu: "DE",
  spanish: "ES", espagnol: "ES", spa: "ES",
  undetermined: "", und: "",
};

function extractLang(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [key, code] of Object.entries(LANG_MAP)) {
    if (lower.includes(key)) return code || null;
  }
  return null;
}
