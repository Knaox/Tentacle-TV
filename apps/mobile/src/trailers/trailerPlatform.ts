import type { ItemTrailerOptions } from "@tentacle-tv/api-client";

/**
 * Ce que le mobile déclare à `useItemTrailer` : il suit le CATALOGUE du
 * serveur (`trailers.catalog`) — un épisode et une saison ont leur
 * bande-annonce — et lit tout dans son écran `/trailer` : la locale dans le
 * lecteur de l'app, Dailymotion en direct, YouTube par le relais. Face à un
 * serveur d'avant le catalogue, `useItemTrailer` garde la règle d'avant.
 */
export const MOBILE_TRAILER_PLATFORM: ItemTrailerOptions = { playable: ["local", "youtube", "dailymotion"], catalog: true };
