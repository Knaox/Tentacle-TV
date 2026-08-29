import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { LeaderboardEntry } from "./types";

/**
 * Ce que Jellyfin sait vraiment, sans plugin : « vu / pas vu », le nombre de
 * lectures et la date de la dernière. Il ne mesure AUCUN temps de visionnage.
 *
 * Les compteurs produits ici sont donc exacts, et la durée est une
 * reconstitution assumée : la somme des durées des titres vus, chacun compté
 * UNE FOIS.
 *
 * Multiplier par `PlayCount` a été essayé et retiré. Jellyfin incrémente ce
 * compteur à chaque reprise de lecture, pas à chaque visionnage complet :
 * mesuré sur une vraie bibliothèque, il vaut 1,5 en moyenne et monte à 6, ce
 * qui gonflait les totaux de près de moitié — un compte à 560 heures en
 * affichait plus de 800. Compter chaque titre une fois sous-estime légèrement
 * les vrais revisionnages, ce qui vaut mieux que de surestimer bruyamment.
 */

/** 10 000 000 de « ticks » Jellyfin par seconde. */
const TICKS_PER_SECOND = 10_000_000;

/** Une page de 500 : au-delà, Jellyfin devient lent et la réponse grossit pour rien. */
const PAGE = 500;

/** Garde-fou : 40 pages, soit 20 000 titres vus par compte. */
const PAGES_MAX = 40;

/** Trois appels de front : assez pour ne pas traîner, assez peu pour ne pas saturer Jellyfin. */
const FRONT = 3;

interface PlayedItem {
  Type?: string;
  RunTimeTicks?: number;
  UserData?: { PlayCount?: number; LastPlayedDate?: string };
}

interface PageItems {
  Items?: PlayedItem[];
  TotalRecordCount?: number;
}

export interface JellyfinAccount {
  id: string;
  name: string;
  hasAvatar: boolean;
}

/**
 * Champs réduits au strict nécessaire : sans `EnableImages=false`, Jellyfin
 * joint les étiquettes d'images de chaque titre et la réponse triple de taille
 * pour des données qu'on jette.
 */
function urlPage(base: string, userId: string, startIndex: number): string {
  const p = new URLSearchParams({
    userId,
    Recursive: "true",
    IncludeItemTypes: "Movie,Episode",
    Filters: "IsPlayed",
    Fields: "RunTimeTicks",
    EnableImages: "false",
    EnableUserData: "true",
    EnableTotalRecordCount: startIndex === 0 ? "true" : "false",
    Limit: String(PAGE),
    StartIndex: String(startIndex),
  });
  return `${base}/Items?${p.toString()}`;
}

/**
 * Agrège un compte. Le pic mémoire est celui d'UNE page : chaque page est
 * repliée en quatre nombres puis abandonnée, jamais accumulée.
 */
async function aggregate(
  base: string,
  key: string,
  account: JellyfinAccount,
  epoch: Date | null,
): Promise<CountedEntry | null> {
  let movies = 0;
  let episodes = 0;
  let seconds = 0;
  let latest: string | null = null;
  let startIndex = 0;
  const epochMs = epoch ? epoch.getTime() : null;

  for (let page = 0; page < PAGES_MAX; page++) {
    let data: PageItems;
    try {
      const res = await fetch(urlPage(base, account.id, startIndex), {
        headers: { "X-Emby-Token": key },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      data = (await res.json()) as PageItems;
    } catch {
      return null;
    }

    const items = data.Items ?? [];
    for (const it of items) {
      if (it.Type === "Movie") movies++;
      else if (it.Type === "Episode") episodes++;
      const playedAt = it.UserData?.LastPlayedDate;
      if (playedAt && (!latest || playedAt > latest)) latest = playedAt;

      // LE DÉCOUPAGE : au-delà de l'époque, c'est la mesure réelle qui compte.
      // Estimer ce qui a été mesuré reviendrait à le compter deux fois.
      const beforeEpoch = epochMs === null || !playedAt || Date.parse(playedAt) < epochMs;
      if (beforeEpoch && it.RunTimeTicks) seconds += it.RunTimeTicks / TICKS_PER_SECOND;
    }

    if (items.length < PAGE) break;
    startIndex += PAGE;
  }

  return {
    userId: account.id,
    name: account.name,
    hasAvatar: account.hasAvatar,
    moviesPlayed: movies,
    episodesPlayed: episodes,
    totalPlayed: movies + episodes,
    // Part ESTIMÉE seulement : l'appelant y ajoutera les secondes mesurées.
    watchSeconds: movies + episodes > 0 ? Math.round(seconds) : null,
    measuredSeconds: 0,
    estimatedSeconds: Math.round(seconds),
    lastPlayedDate: latest,
  };
}

type CountedEntry = LeaderboardEntry;

/** Exécute les agrégations par petits paquets plutôt que toutes d'un coup. */
export async function statsCore(
  accounts: JellyfinAccount[],
  epoch: Date | null,
): Promise<LeaderboardEntry[]> {
  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) return [];

  const rows: LeaderboardEntry[] = [];
  for (let i = 0; i < accounts.length; i += FRONT) {
    const batch = accounts.slice(i, i + FRONT);
    const results = await Promise.all(batch.map((c) => aggregate(base, key, c, epoch)));
    // Un compte qui échoue est simplement absent du classement : mieux vaut un
    // classement incomplet qu'une page d'erreur pour tout le monde.
    for (const r of results) if (r) rows.push(r);
  }
  return rows;
}
