import type { RecoPageRow, RecoRowItem } from "../reco/recoPageTypes";
import type { ServerCapability } from "../serverCapabilities/serverCapabilities";

/**
 * Les SOURCES du bandeau principal de l'accueil — ce que le compte choisit
 * dans Réglages › Personnalisation, gardé par le serveur
 * (`/api/preferences/home-layout` › `heroMode`) et lu par chaque client
 * (web, bureau, miroir, mobile, Apple TV, Android TV).
 *
 * ⚠️ Les valeurs traversent le réseau et vivent dans la base : elles ne se
 * renomment jamais. Le backend recopie la liste dans son schéma
 * (`preferences.homeLayout.ts`), et un test la tient alignée.
 *
 * - `resume` : les visionnages à reprendre, sinon la sélection du serveur ;
 * - `random` : la sélection du serveur ;
 * - `reco` : un tirage de « Pour vous », qui change à chaque visite ;
 * - `recoMovies` / `recoSeries` (serveur 1.30.0, capacité `home.heroRecoKinds`) :
 *   les FILMS / les SÉRIES les mieux recommandés, dans l'ordre servi par le
 *   moteur ;
 * - `fixed` : un titre des favoris.
 *
 * Un client d'avant `recoMovies` / `recoSeries` qui les lit retombe sur la
 * reprise (sa règle du mode inconnu) : rien ne casse, rien ne s'affiche vide.
 */
export const HERO_MODES = ["resume", "random", "reco", "recoMovies", "recoSeries", "fixed"] as const;
export type HeroMode = (typeof HERO_MODES)[number];

/** Les sources « Pour vous » par genre de titre : un serveur d'avant les refuserait (400). */
export const HERO_RECO_KINDS_CAPABILITY: ServerCapability = "home.heroRecoKinds";

const RECO_KIND_MODES: readonly HeroMode[] = ["recoMovies", "recoSeries"];

export function isHeroMode(value: unknown): value is HeroMode {
  return typeof value === "string" && (HERO_MODES as readonly string[]).includes(value);
}

/** Ce que tire une source « Pour vous » : tout, les films, les séries. */
export type RecoHeroKind = "all" | "movie" | "tv";

/** La part de « Pour vous » qu'une source montre ; `null` : la source n'est pas « Pour vous ». */
export function recoHeroKindOf(mode: string | null | undefined): RecoHeroKind | null {
  if (mode === "reco") return "all";
  if (mode === "recoMovies") return "movie";
  if (mode === "recoSeries") return "tv";
  return null;
}

/**
 * Les sources que l'écran Personnalisation PROPOSE, dans l'ordre affiché :
 * les deux sources « Pour vous » par genre seulement face à un serveur qui
 * les déclare. La valeur en vigueur reste lisible même si elle n'est plus
 * proposée (un autre appareil l'a posée) : elle est ajoutée à sa place.
 */
export function heroModesOffered(capabilities: ReadonlySet<ServerCapability>, current?: string | null): HeroMode[] {
  const kinds = capabilities.has(HERO_RECO_KINDS_CAPABILITY);
  return HERO_MODES.filter((mode) => kinds || !RECO_KIND_MODES.includes(mode) || mode === current);
}

/** Titres au plus dans un bandeau « Pour vous » par genre. */
export const RECO_HERO_TOP_MAX = 5;

/**
 * Les titres d'un bandeau « Films » ou « Séries » : les MIEUX recommandés,
 * dans l'ordre où le moteur les sert — la rangée « Pour vous » réduite au
 * genre, sans ses titres d'exploration (des paris, pas les meilleurs scores),
 * complétée pour les films par la rangée « Films pour vous » quand la page
 * la porte. `accept` écarte ce que le client ne sait pas montrer (pas de
 * visuel large, hors bibliothèque sur un téléviseur). Module pur.
 */
export function topRecoHeroItems(
  rows: readonly RecoPageRow[] | undefined,
  kind: Exclude<RecoHeroKind, "all">,
  options: { max?: number; accept?: (item: RecoRowItem) => boolean } = {},
): RecoRowItem[] {
  const { max = RECO_HERO_TOP_MAX, accept = () => true } = options;
  const rowItems = (key: string) => rows?.find((row) => row.key === key)?.items ?? [];
  const candidates = [...rowItems("forYou"), ...(kind === "movie" ? rowItems("forYouMovies") : [])];
  const seen = new Set<string>();
  const picked: RecoRowItem[] = [];
  for (const item of candidates) {
    if (picked.length >= max) break;
    if (item.mediaType !== kind || item.exploration || seen.has(item.key) || !accept(item)) continue;
    seen.add(item.key);
    picked.push(item);
  }
  return picked;
}

/** Les mots de chaque source (espace i18n `homeSettings`) : son nom, et ce qu'elle MET dans le bandeau. */
const HERO_MODE_COPY: Readonly<Record<HeroMode, { label: string; hint: string }>> = {
  resume: { label: "heroResume", hint: "heroResumeHint" },
  random: { label: "heroRandom", hint: "heroRandomHint" },
  reco: { label: "heroReco", hint: "heroRecoHint" },
  recoMovies: { label: "heroRecoMovies", hint: "heroRecoMoviesHint" },
  recoSeries: { label: "heroRecoSeries", hint: "heroRecoSeriesHint" },
  fixed: { label: "heroFixed", hint: "heroFixedHint" },
};

/** La clé `homeSettings:` du nom d'une source ; une valeur inconnue : celle de la reprise (son repli). */
export function heroModeLabelKey(mode: string): string {
  return `homeSettings:${(isHeroMode(mode) ? HERO_MODE_COPY[mode] : HERO_MODE_COPY.resume).label}`;
}

/** La clé `homeSettings:` de ce que la source montre. */
export function heroModeHintKey(mode: string): string {
  return `homeSettings:${(isHeroMode(mode) ? HERO_MODE_COPY[mode] : HERO_MODE_COPY.resume).hint}`;
}
