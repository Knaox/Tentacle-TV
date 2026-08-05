import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { LigneClassement } from "./types";

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
const TICKS_PAR_SECONDE = 10_000_000;

/** Une page de 500 : au-delà, Jellyfin devient lent et la réponse grossit pour rien. */
const PAGE = 500;

/** Garde-fou : 40 pages, soit 20 000 titres vus par compte. */
const PAGES_MAX = 40;

/** Trois appels de front : assez pour ne pas traîner, assez peu pour ne pas saturer Jellyfin. */
const FRONT = 3;

interface ItemVu {
  Type?: string;
  RunTimeTicks?: number;
  UserData?: { PlayCount?: number; LastPlayedDate?: string };
}

interface PageItems {
  Items?: ItemVu[];
  TotalRecordCount?: number;
}

export interface CompteJellyfin {
  id: string;
  name: string;
  hasAvatar: boolean;
}

/**
 * Champs réduits au strict nécessaire : sans `EnableImages=false`, Jellyfin
 * joint les étiquettes d'images de chaque titre et la réponse triple de taille
 * pour des données qu'on jette.
 */
function urlPage(base: string, userId: string, depart: number): string {
  const p = new URLSearchParams({
    userId,
    Recursive: "true",
    IncludeItemTypes: "Movie,Episode",
    Filters: "IsPlayed",
    Fields: "RunTimeTicks",
    EnableImages: "false",
    EnableUserData: "true",
    EnableTotalRecordCount: depart === 0 ? "true" : "false",
    Limit: String(PAGE),
    StartIndex: String(depart),
  });
  return `${base}/Items?${p.toString()}`;
}

/**
 * Agrège un compte. Le pic mémoire est celui d'UNE page : chaque page est
 * repliée en quatre nombres puis abandonnée, jamais accumulée.
 */
async function agreger(
  base: string,
  cle: string,
  compte: CompteJellyfin,
  epoque: Date | null,
): Promise<LigneChiffree | null> {
  let films = 0;
  let episodes = 0;
  let secondes = 0;
  let derniere: string | null = null;
  let depart = 0;
  const epoqueMs = epoque ? epoque.getTime() : null;

  for (let page = 0; page < PAGES_MAX; page++) {
    let data: PageItems;
    try {
      const res = await fetch(urlPage(base, compte.id, depart), {
        headers: { "X-Emby-Token": cle },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      data = (await res.json()) as PageItems;
    } catch {
      return null;
    }

    const items = data.Items ?? [];
    for (const it of items) {
      if (it.Type === "Movie") films++;
      else if (it.Type === "Episode") episodes++;
      const vue = it.UserData?.LastPlayedDate;
      if (vue && (!derniere || vue > derniere)) derniere = vue;

      // LE DÉCOUPAGE : au-delà de l'époque, c'est la mesure réelle qui compte.
      // Estimer ce qui a été mesuré reviendrait à le compter deux fois.
      const avantEpoque = epoqueMs === null || !vue || Date.parse(vue) < epoqueMs;
      if (avantEpoque && it.RunTimeTicks) secondes += it.RunTimeTicks / TICKS_PAR_SECONDE;
    }

    if (items.length < PAGE) break;
    depart += PAGE;
  }

  return {
    userId: compte.id,
    name: compte.name,
    hasAvatar: compte.hasAvatar,
    moviesPlayed: films,
    episodesPlayed: episodes,
    totalPlayed: films + episodes,
    // Part ESTIMÉE seulement : l'appelant y ajoutera les secondes mesurées.
    watchSeconds: films + episodes > 0 ? Math.round(secondes) : null,
    measuredSeconds: 0,
    estimatedSeconds: Math.round(secondes),
    lastPlayedDate: derniere,
  };
}

type LigneChiffree = LigneClassement;

/** Exécute les agrégations par petits paquets plutôt que toutes d'un coup. */
export async function statsCore(
  comptes: CompteJellyfin[],
  epoque: Date | null,
): Promise<LigneClassement[]> {
  const base = getJellyfinUrl();
  const cle = getJellyfinApiKey();
  if (!base || !cle) return [];

  const lignes: LigneClassement[] = [];
  for (let i = 0; i < comptes.length; i += FRONT) {
    const paquet = comptes.slice(i, i + FRONT);
    const resultats = await Promise.all(paquet.map((c) => agreger(base, cle, c, epoque)));
    // Un compte qui échoue est simplement absent du classement : mieux vaut un
    // classement incomplet qu'une page d'erreur pour tout le monde.
    for (const r of resultats) if (r) lignes.push(r);
  }
  return lignes;
}
