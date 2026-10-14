import { TRAILER_PLATFORM_LEGACY, type ItemTrailerOptions } from "@tentacle-tv/api-client";
import { TRAILER_PLAYER_AVAILABLE } from "../trailerPlayer";
import { useFullTrailerPlayer } from "./TrailerViewer";

/** Le lecteur complet : tout le catalogue se lit, Dailymotion (AlloCiné) compris, par le relais. */
const FULL_PLAYER: ItemTrailerOptions = { playable: ["local", "youtube", "dailymotion"], catalog: true };
/** Un serveur au catalogue sans lecteur relayé : ses vidéos YouTube, par la modale. */
const YOUTUBE_ONLY: ItemTrailerOptions = { playable: ["local", "youtube"], catalog: true };

/**
 * Ce que le web, le bureau et le miroir déclarent à `useItemTrailer` : ils
 * suivent le CATALOGUE du serveur (`trailers.catalog`) — un épisode et une
 * saison ont leur bande-annonce —, et le lisent par le lecteur complet quand
 * le serveur le relaie (`trailers.player`). La dalle LG (sans lecteur
 * complet, en pause) garde la règle d'avant.
 */
export function useWebTrailerPlatform(): ItemTrailerOptions {
  const full = useFullTrailerPlayer();
  if (!TRAILER_PLAYER_AVAILABLE) return TRAILER_PLATFORM_LEGACY;
  return full ? FULL_PLAYER : YOUTUBE_ONLY;
}
