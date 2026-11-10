/**
 * Les préférences du COMPTE (`/api/preferences/*`, hors rappels masqués) : lecture, « Vous
 * regardez encore ? », mise en page de l'accueil, recommandations, langues par bibliothèque,
 * langue de l'interface. L'état vit en mémoire le temps de la page : un interrupteur basculé
 * dans le labo garde sa position (les écrans relisent après chaque écriture).
 */

import { DEFAULT_PLAYBACK_SETTINGS, DEFAULT_STILL_WATCHING_SETTINGS } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { LAB_USER } from "./base";
import { LAB_LIBRARIES } from "./settingsJellyfin";
import { record, type Json, type LabRequest } from "./settingsShared";

/** Le catalogue des rangées statiques d'un serveur qui a sa clé TMDB (sans Vigie : pas de « À découvrir »). */
const HOME_CATALOG = [
  { key: "resume", enabled: true },
  { key: "nextUp", enabled: true },
  { key: "reco:forYou", enabled: true },
  { key: "watched", enabled: true },
  { key: "watchlist", enabled: true },
  { key: "favorites", enabled: false },
  { key: "reco:forYouMovies", enabled: false },
  { key: "reco:inLibrary", enabled: false },
  { key: "reco:anime", enabled: false },
  { key: "reco:trending", enabled: false },
  { key: "reco:serverPulse", enabled: false },
  { key: "reco:community", enabled: false },
  { key: "reco:exploration", enabled: false },
  { key: "reco:bestOfLibrary", enabled: false },
];

/** Un accueil que le compte a ARRANGÉ : bibliothèques placées, deux rangées en plus, une coupée. */
let homeLayout: Json = {
  heroMode: "reco",
  heroFixedItemId: null,
  cardDensity: "normal",
  rows: [
    { key: "resume", enabled: true },
    { key: "nextUp", enabled: true },
    { key: "reco:forYou", enabled: true },
    { key: "library:lib-films", enabled: true },
    { key: "library:lib-series", enabled: true },
    { key: "library:lib-animes", enabled: true },
    { key: "library:lib-musique", enabled: false },
    { key: "watchlist", enabled: true },
    { key: "favorites", enabled: true },
    { key: "watched", enabled: false },
    { key: "reco:trending", enabled: true },
  ],
};

let recoSettings: Json = {
  personalized: true,
  includeVigie: true,
  community: true,
  shareHistory: false,
  explorationBalance: 60,
  providerFilter: [],
  trendingNow: true,
};

let stillWatching: Json = { ...DEFAULT_STILL_WATCHING_SETTINGS, afterMs: 7_200_000 };
let playback: unknown = {
  ...DEFAULT_PLAYBACK_SETTINGS,
  intro: { ...DEFAULT_PLAYBACK_SETTINGS.intro, action: "auto" },
  recap: { ...DEFAULT_PLAYBACK_SETTINGS.recap, action: "auto" },
};
let interfaceLanguage: string | null = "fr";

interface LibraryPreference {
  id: string;
  jellyfinUserId: string;
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: string;
}

const preference = (libraryId: string, audioLang: string | null, subtitleLang: string | null, subtitleMode: string): LibraryPreference => ({
  id: `pref-${libraryId}`, jellyfinUserId: LAB_USER.Id, libraryId, audioLang, subtitleLang, subtitleMode,
});

/** Films en VF, séries en VO sous-titrée, animés en japonais sous-titré ; la musique n'a rien de réglé. */
let libraryPreferences: LibraryPreference[] = [
  preference("lib-films", "fre", "fre", "forced"),
  preference("lib-series", "eng", "fre", "always"),
  preference("lib-animes", "jpn", "fre", "always"),
];

const LIBRARY_PATH = /^\/api\/preferences\/(lib-[\w-]+)$/;
const libraryIdOf = (url: URL): string => LIBRARY_PATH.exec(url.pathname)?.[1] ?? "";
const known = (libraryId: string): boolean => LAB_LIBRARIES.some((library) => library.id === libraryId);

export function preferencesRoutes(): readonly LabRoute[] {
  return [
    // ── Lecture : passages, épisode suivant ──
    { path: "/api/preferences/playback", reply: () => ({ stored: true, settings: playback }) },
    {
      method: "PUT",
      path: "/api/preferences/playback",
      reply: ({ body }: LabRequest) => {
        playback = body;
        return { stored: true, settings: playback };
      },
    },
    { path: "/api/preferences/still-watching", reply: () => ({ stored: true, settings: stillWatching }) },
    {
      method: "PUT",
      path: "/api/preferences/still-watching",
      reply: ({ body }: LabRequest) => {
        stillWatching = { ...stillWatching, ...record(body) };
        return { stored: true, settings: stillWatching };
      },
    },

    // ── Accueil et découverte ──
    { path: "/api/preferences/home-layout", reply: () => ({ stored: true, layout: homeLayout, catalog: HOME_CATALOG }) },
    {
      method: "PUT",
      path: "/api/preferences/home-layout",
      reply: ({ body }: LabRequest) => {
        homeLayout = { ...homeLayout, ...record(body) };
        return { ok: true };
      },
    },
    { path: "/api/preferences/reco", reply: () => ({ stored: true, settings: recoSettings, vigieAvailable: false }) },
    {
      method: "PUT",
      path: "/api/preferences/reco",
      reply: ({ body }: LabRequest) => {
        recoSettings = { ...recoSettings, ...record(body) };
        return { ok: true };
      },
    },
    { method: "POST", path: "/api/reco/profile/reset", reply: { ok: true } },

    // ── Langues : l'interface, puis une préférence par bibliothèque ──
    { path: "/api/preferences/language", reply: () => ({ language: interfaceLanguage }) },
    {
      method: "PUT",
      path: "/api/preferences/language",
      reply: ({ body }: LabRequest) => {
        const language = record(body).language;
        interfaceLanguage = typeof language === "string" ? language : interfaceLanguage;
        return { language: interfaceLanguage };
      },
    },
    { path: "/api/preferences/", reply: () => libraryPreferences },
    {
      method: "PUT",
      path: "/api/preferences/",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        const libraryId = typeof input.libraryId === "string" && known(input.libraryId) ? input.libraryId : "lib-films";
        const previous = libraryPreferences.find((entry) => entry.libraryId === libraryId) ?? preference(libraryId, null, null, "none");
        const next: LibraryPreference = {
          ...previous,
          audioLang: "audioLang" in input ? (input.audioLang as string | null) : previous.audioLang,
          subtitleLang: "subtitleLang" in input ? (input.subtitleLang as string | null) : previous.subtitleLang,
          subtitleMode: typeof input.subtitleMode === "string" ? input.subtitleMode : previous.subtitleMode,
        };
        libraryPreferences = [...libraryPreferences.filter((entry) => entry.libraryId !== libraryId), next];
        return next;
      },
    },
    // L'absence d'une préférence répond 200 + `null` (jamais 404).
    { path: LIBRARY_PATH, reply: ({ url }: LabRequest) => libraryPreferences.find((entry) => entry.libraryId === libraryIdOf(url)) ?? null },
    {
      method: "DELETE",
      path: LIBRARY_PATH,
      reply: ({ url }: LabRequest) => {
        libraryPreferences = libraryPreferences.filter((entry) => entry.libraryId !== libraryIdOf(url));
        return { ok: true };
      },
    },
  ];
}
