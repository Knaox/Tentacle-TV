import type { ItemTrailerOptions } from "@tentacle-tv/api-client";
import { TRAILER_PLAYER_AVAILABLE } from "../trailerPlayer";

/**
 * Ce que le web, le bureau et le miroir déclarent à `useItemTrailer` : ils
 * suivent le CATALOGUE du serveur (`trailers.catalog`) — un épisode et une
 * saison ont leur bande-annonce. La dalle LG (sans lecteur complet, en pause)
 * garde la règle d'avant.
 *
 * Les vidéos en ligne restent ici des vidéos YouTube (modale, ou lecteur
 * complet par `TrailerViewer`) tant que les boutons n'ouvrent pas le lecteur
 * complet sur une entrée du catalogue (Dailymotion compris).
 */
export const WEB_TRAILER_PLATFORM: ItemTrailerOptions = TRAILER_PLAYER_AVAILABLE
  ? { playable: ["local", "youtube"], catalog: true }
  : { playable: ["local", "youtube"], catalog: false };
