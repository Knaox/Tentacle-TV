/**
 * Ce que le compte ATTEND d'une extension de demandes — pur, sans React. Deux
 * routes facultatives du contrat `titles` (cf. `pluginTitles.ts`, et
 * `pluginTitlesMeta.ts` côté serveur) :
 *
 *   GET access       → { request: boolean }
 *     le compte peut-il demander quoi que ce soit (faux : bloqué, ou aucun
 *     type de titre permis) ;
 *   GET mine?lang=fr → { items: [{ key, title, year, imageUrl, seasons, state, percent, etaSeconds }] }
 *     les titres qu'il attend — demandés, pas encore dans la bibliothèque —,
 *     un par titre, les plus récents d'abord. `etaSeconds` (ajouté après
 *     coup, facultatif) : le temps qu'il reste à un titre qui arrive VRAIMENT
 *     — de quoi faire avancer son avancement entre deux lectures. `origin`
 *     (venu après, facultatif) : ceux d'une origine seulement — « tv », les
 *     demandes faites depuis un téléviseur (`pluginTitleOrigin.ts`).
 *
 * À la différence des pastilles de `state`, seul l'ÉTAT voyage : les mots sont
 * ceux de Tentacle (`MY_TITLE_STATE_KEYS`, espace i18n `requests`), les mêmes
 * partout où une carte ou une liste le dit — et jamais un mot qu'un relecteur
 * d'Apple lirait comme une distribution de contenu hors boutique.
 *
 * Comme le reste du contrat, chaque champ est validé : un titre illisible, ou
 * dans un état que ce client ne connaît pas, est écarté — jamais affiché à
 * moitié, jamais sous un mot inventé.
 */

import { parseTitleKey, type TitleKey, type TitleMediaType, type TitleProvider } from "./pluginTitles";
import type { TitleOrigin } from "./pluginTitleOrigin";

/** Pas encore validé · en route · rangé dans la bibliothèque · bloqué en chemin. */
export type MyTitleState = "pending" | "arriving" | "importing" | "blocked";

export const MY_TITLE_STATES: readonly MyTitleState[] = ["pending", "arriving", "importing", "blocked"];

export interface MyTitle {
  key: TitleKey;
  mediaType: TitleMediaType;
  tmdbId: number;
  title: string;
  year: number | null;
  imageUrl: string | null;
  /** Les saisons demandées d'une série, croissantes ; `null` : un film, ou la série entière. */
  seasons: number[] | null;
  state: MyTitleState;
  /** 0 à 100 quand le titre arrive et que l'avancement se sait ; sinon `null`. */
  percent: number | null;
  /** Les secondes qu'il lui reste, quand il arrive et que ça avance ; sinon
   *  `null` — une extension d'avant ce champ, ou rien qui descende. */
  etaSeconds: number | null;
}

export interface TitlesAccess {
  /** Faux : compte bloqué, ou aucun type de titre permis. */
  request: boolean;
}

/** Les mots des états, une seule source : leur clé i18n (espace `requests`). */
export const MY_TITLE_STATE_KEYS: Record<MyTitleState, string> = {
  pending: "requests:statePending",
  arriving: "requests:stateArriving",
  importing: "requests:stateImporting",
  blocked: "requests:stateBlocked",
};

/** « 42 % » : l'avancement d'un titre en route, entier (`{{percent}}`). */
export const MY_TITLE_PERCENT_KEY = "requests:percent";

/** Au plus autant de titres attendus : au-delà, la liste ne se lit plus. */
export const MAX_MY_TITLES = 50;

const MAX_SEASONS = 100;
/** Au-delà d'une semaine, un temps restant n'annonce plus rien d'utile. */
const MAX_ETA_SECONDS = 7 * 24 * 3600;

function pluginRoute(provider: TitleProvider, path: string): string {
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${path}`;
}

export function titlesAccessUrl(provider: TitleProvider): string | null {
  return provider.accessPath === null ? null : pluginRoute(provider, provider.accessPath);
}

/** Les titres attendus ; `origin` : ceux de cette origine seulement — sinon tous, comme avant. */
export function myTitlesUrl(provider: TitleProvider, lang: string, origin: TitleOrigin | null = null): string | null {
  if (provider.minePath === null) return null;
  const params = new URLSearchParams({ lang });
  if (origin) params.set("origin", origin);
  return `${pluginRoute(provider, provider.minePath)}?${params.toString()}`;
}

/** Le droit du compte ; illisible : `null` — l'appelant le tient pour fermé. */
export function readTitlesAccess(raw: unknown): TitlesAccess | null {
  if (!raw || typeof raw !== "object") return null;
  const request = (raw as { request?: unknown }).request;
  return typeof request === "boolean" ? { request } : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;
}

/* Une image d'un autre site (TMDB), comme les résultats de recherche. */
function safeImage(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//i.test(value) && value.length <= 500 ? value : null;
}

function readYear(value: unknown): number | null {
  const year = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : value;
  return typeof year === "number" && Number.isInteger(year) && year >= 1870 && year <= 2200 ? year : null;
}

function readSeasons(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const seasons = new Set<number>();
  for (const n of value) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 1000) seasons.add(n);
    if (seasons.size >= MAX_SEASONS) break;
  }
  return seasons.size > 0 ? [...seasons].sort((a, b) => a - b) : null;
}

function readPercent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

function readEta(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_ETA_SECONDS ? Math.round(value) : null;
}

/** Un titre attendu, validé champ par champ ; `null` s'il ne se lit pas. */
export function readMyTitle(raw: unknown): MyTitle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parsed = typeof r.key === "string" ? parseTitleKey(r.key) : null;
  const title = text(r.title, 200);
  const state = MY_TITLE_STATES.find((s) => s === r.state);
  if (!parsed || title === null || !state) return null;
  return {
    key: r.key as TitleKey,
    mediaType: parsed.mediaType,
    tmdbId: parsed.tmdbId,
    title,
    year: readYear(r.year),
    imageUrl: safeImage(r.imageUrl),
    seasons: parsed.mediaType === "tv" ? readSeasons(r.seasons) : null,
    state,
    // L'avancement ne se dit que d'un titre en route : bloqué ou rangé, la barre n'a plus de sens.
    percent: state === "arriving" ? readPercent(r.percent) : null,
    etaSeconds: state === "arriving" ? readEta(r.etaSeconds) : null,
  };
}

/** La réponse de `mine` : un titre par clé, dans l'ordre du plugin, borné. */
export function readMyTitles(raw: unknown): MyTitle[] {
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return [];
  const out: MyTitle[] = [];
  const seen = new Set<TitleKey>();
  for (const item of items) {
    const title = readMyTitle(item);
    if (!title || seen.has(title.key)) continue;
    seen.add(title.key);
    out.push(title);
    if (out.length >= MAX_MY_TITLES) break;
  }
  return out;
}

/**
 * Un titre qu'on vient de demander, en tête des titres attendus (ou remis en
 * tête s'il y était) — le patch du cache après « Demander » : la liste le
 * montre aussitôt, sans attendre la relecture.
 */
export function withMyTitle(list: readonly MyTitle[], title: MyTitle): MyTitle[] {
  return [title, ...list.filter((t) => t.key !== title.key)].slice(0, MAX_MY_TITLES);
}

/**
 * Les saisons demandées, en morceaux lisibles — trois de suite ou plus font un
 * intervalle : [1, 2, 3, 4, 6] → « 1–4 », « 6 ». À l'appelant de les joindre
 * dans sa langue (« Saisons 1–4 et 6 »).
 */
export function seasonRuns(seasons: readonly number[]): string[] {
  const sorted = [...new Set(seasons)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) out.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) out.push(String(sorted[k]));
    i = j + 1;
  }
  return out;
}
