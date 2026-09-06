/**
 * Les réglages de langues du COMPTE Jellyfin (`Configuration` de l'utilisateur :
 * langue audio, langue de sous-titres, mode), photographiés en ligne et lus
 * hors ligne comme DERNIER repli — après le choix par contenu et la préférence
 * par bibliothèque. Sans eux, un compte sans préférence Tentacle laissait le
 * lecteur local choisir au hasard là où le serveur aurait suivi le profil.
 *
 * Le mode Jellyfin est ramené au mode du résolveur partagé : `Always` →
 * toujours, `OnlyForced` → forcés, `None` → aucun, `Default` → forcés (les
 * drapeaux du fichier, au plus près), `Smart` → deux passes : l'audio d'abord,
 * et des sous-titres seulement si sa langue n'est pas celle qu'on préfère.
 */

import { resolveMediaTracks, type AudioTrackInfo, type SubtitleTrackInfo, type TrackResolution } from "@tentacle-tv/shared";
import { primaryLangSubtag } from "../playback/langSubtags";
import type { KeyValueStore, SubtitleMode } from "./trackPrefsCache";

export type JellyfinSubtitleMode = "Default" | "Always" | "OnlyForced" | "None" | "Smart";

export interface UserTrackConfig {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: JellyfinSubtitleMode;
  /** « Lire la piste audio par défaut » : la langue audio n'est pas imposée. */
  playDefaultAudioTrack: boolean;
}

/** Nouvelle clé (jamais renommée ensuite), par compte. */
export const userTrackConfigKey = (userId: string): string => `tentacle_user_track_config_${userId}`;

const MODES: ReadonlySet<string> = new Set(["Default", "Always", "OnlyForced", "None", "Smart"]);

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const lang = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

/** `GET Users/Me` (ou le DTO de connexion) → les quatre réglages, ou `null` sans `Configuration`. */
export function parseUserTrackConfig(raw: unknown): UserTrackConfig | null {
  const user = record(raw);
  const configuration = record(user?.Configuration);
  if (configuration === null) return null;
  const mode = configuration.SubtitleMode;
  return {
    audioLang: lang(configuration.AudioLanguagePreference),
    subtitleLang: lang(configuration.SubtitleLanguagePreference),
    subtitleMode: typeof mode === "string" && MODES.has(mode) ? (mode as JellyfinSubtitleMode) : "Default",
    playDefaultAudioTrack: configuration.PlayDefaultAudioTrack === true,
  };
}

export function cacheUserTrackConfig(store: KeyValueStore, userId: string, config: UserTrackConfig): void {
  store.set(userTrackConfigKey(userId), JSON.stringify(config));
}

export function readUserTrackConfig(store: KeyValueStore, userId: string): UserTrackConfig | null {
  const raw = store.get(userTrackConfigKey(userId));
  if (raw === null) return null;
  try {
    const parsed = record(JSON.parse(raw));
    if (parsed === null) return null;
    const mode = parsed.subtitleMode;
    return {
      audioLang: lang(parsed.audioLang),
      subtitleLang: lang(parsed.subtitleLang),
      subtitleMode: typeof mode === "string" && MODES.has(mode) ? (mode as JellyfinSubtitleMode) : "Default",
      playDefaultAudioTrack: parsed.playDefaultAudioTrack === true,
    };
  } catch {
    return null;
  }
}

function sharedMode(mode: JellyfinSubtitleMode): SubtitleMode {
  switch (mode) {
    case "Always":
      return "always";
    case "None":
      return "none";
    case "OnlyForced":
    case "Default":
    case "Smart":
      return "forced";
  }
}

const sameLanguage = (a: string | undefined, b: string | null): boolean => {
  if (!a || !b) return false;
  const left = primaryLangSubtag(a.split(/[-_]/)[0]) ?? a.toLowerCase();
  const right = primaryLangSubtag(b.split(/[-_]/)[0]) ?? b.toLowerCase();
  return left === right;
};

/** Le repli Jellyfin, résolu par LE MÊME algorithme que le serveur. */
export function resolveWithUserConfig(
  config: UserTrackConfig,
  userId: string,
  libraryId: string,
  audioTracks: AudioTrackInfo[],
  subtitleTracks: SubtitleTrackInfo[],
): TrackResolution {
  const audioLang = config.playDefaultAudioTrack ? null : config.audioLang;
  const base = { jellyfinUserId: userId, libraryId, audioLang, subtitleLang: config.subtitleLang };
  const first = resolveMediaTracks({ ...base, subtitleMode: sharedMode(config.subtitleMode) }, audioTracks, subtitleTracks);
  if (config.subtitleMode !== "Smart") return first;

  // Smart : l'audio retenu est-il déjà dans la langue voulue ? Alors forcés
  // seulement (première passe) ; sinon des sous-titres complets.
  const audio = audioTracks.find((track) => track.index === first.audioIndex);
  const wanted = config.subtitleLang ?? audioLang;
  if (sameLanguage(audio?.language, wanted)) return first;
  const second = resolveMediaTracks({ ...base, subtitleMode: "always" }, audioTracks, subtitleTracks);
  return { audioIndex: first.audioIndex, subtitleIndex: second.subtitleIndex ?? first.subtitleIndex };
}
