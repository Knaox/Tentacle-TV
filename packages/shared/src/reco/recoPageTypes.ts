/**
 * Le contrat de `GET /api/reco/page` : la page « Pour vous » d'un compte —
 * l'état du moteur, les rangées et leurs titres. Depuis 2026-10 il dit aussi
 * POURQUOI : la raison structurée de chaque titre (`why`), sa correspondance
 * estimée (`match`), le thème d'une rangée (`why` de la rangée) et le titre
 * « à la une » (`featured`). Le serveur ne fait que des faits ; le CLIENT les
 * met en mots (i18n FR/EN) — jamais une phrase toute faite du serveur.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/services/reco/recoPageTypes.ts` (le backend ne dépend pas
 * de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). On le
 * modifie ICI, puis :
 *
 *   cp packages/shared/src/reco/recoPageTypes.ts apps/backend/src/services/reco/
 *
 * `recoPageMirror.test.ts` (backend) refuse toute divergence. Aucun import : le
 * fichier doit compiler seul des deux côtés.
 *
 * Compatibilité : tout ajout est OPTIONNEL. Un serveur plus ancien ne l'envoie
 * pas, et le client n'affiche alors rien de nouveau ; un client plus ancien
 * l'ignore et garde `reasons`. Les valeurs des listes fermées (`kind`, `role`,
 * `tag`, `signal`) traversent le réseau : elles ne se renomment JAMAIS, et un
 * client ignore une valeur qu'il ne connaît pas (`isRecoWhy`).
 */

export type RecoState = "disabled" | "cold" | "warming" | "ready";

/** Raison HISTORIQUE (une facette brute) — servie tant qu'un client d'avant `why` existe. */
export interface RecoReason {
  kind: "facet" | "seed" | "exploration";
  key?: string;
  label?: string;
  seedTitle?: string;
}

/** Une plateforme où le titre est INCLUS (abonnement, pub, gratuit). */
export interface RecoProviderRef {
  id: number;
  name: string;
  logoPath: string | null;
}

// ── Ce que citent les raisons ───────────────────────────────────────────────

/** Un titre cité (« Parce que tu as adoré Twin Peaks ») : clé canonique « tv:1920 ». */
export interface RecoTitleRef {
  key: string;
  title: string;
}

/** Une personne citée, par son identifiant TMDB. */
export interface RecoPersonRef {
  id: number;
  name: string;
}

/** Une maison citée : un studio (A24) ou une chaîne (HBO), identifiant TMDB. */
export interface RecoCompanyRef {
  id: number;
  name: string;
  kind: "studio" | "network";
}

/** Une saga TMDB (« Dune - Saga »), identifiant de collection TMDB. */
export interface RecoCollectionRef {
  id: number;
  name: string;
}

/** Un genre TMDB : le client le traduit par son identifiant, `name` est le repli. */
export interface RecoGenreRef {
  id: number;
  name: string;
}

/** Le métier d'une personne dans une raison — liste fermée, traduite par le client. */
export const RECO_CREDIT_ROLES = ["director", "creator", "writer", "cinematographer", "composer", "actor"] as const;
export type RecoCreditRole = (typeof RECO_CREDIT_ROLES)[number];

/**
 * Les thèmes NOMMÉS que le client sait dire (« twist » → « Retournements »).
 * Liste fermée, qui ne fait que s'allonger : le moteur y range des mots-clés
 * TMDB ; un thème sans nom garde son libellé brut (`RecoThemeRef.label`).
 */
export const RECO_THEME_TAGS = [
  "twist",
  "mindBending",
  "nonLinear",
  "unreliableNarrator",
  "neoNoir",
  "psychologicalThriller",
  "slowBurn",
  "heist",
  "timeTravel",
  "dystopia",
  "conspiracy",
  "investigation",
  "comingOfAge",
  "trueStory",
  "darkComedy",
  "survival",
  "politicalIntrigue",
  "superhero",
  "spaceOpera",
  "feelGood",
] as const;
export type RecoThemeTag = (typeof RECO_THEME_TAGS)[number];

/** Un thème cité : la facette du moteur (« kw:9748 »), son libellé TMDB (anglais), son nom s'il en a un. */
export interface RecoThemeRef {
  key: string;
  label: string;
  tag?: RecoThemeTag;
}

// ── La raison structurée ────────────────────────────────────────────────────

/**
 * POURQUOI ce titre, pour CE compte — des faits que le client met en mots :
 * - `similarTo` : « Parce que tu as adoré Twin Peaks et The Leftovers » (1 à 3 titres ;
 *   `signal` dit ce qui les rend chers : aimés, ou seulement regardés) ;
 * - `person` : « Du réalisateur de Prisoners », « Musique de Hans Zimmer » ;
 * - `theme` : « Retournements, comme The Prestige » ;
 * - `company` : « Une série HBO, comme The Wire » ;
 * - `collection` : « Dans la saga Dune » — seulement pour qui la suit ;
 * - `origin` : « Cinéma coréen, comme Parasite » (ISO 639-1, ISO 3166-1) ;
 * - `genre` : le repli le plus faible, quand rien de plus précis ne tient ;
 * - `hiddenGem` : « Pépite méconnue, 8,4/10 » — note TMDB sur 10, une décimale ;
 * - `acclaimed` : « Salué par le public, 8,7/10 » ;
 * - `recent` : « Nouveauté 2026 » ;
 * - `kindredViewers` : « Adoré par des comptes au goût proche du tien » — jamais
 *   un nom, jamais un nombre ;
 * - `exploration` : « Pour sortir de tes habitudes ».
 * `via` : le titre aimé qui fait le lien, quand il y en a un.
 */
export type RecoWhy =
  | { kind: "similarTo"; titles: RecoTitleRef[]; signal?: "loved" | "watched" }
  | { kind: "person"; person: RecoPersonRef; role: RecoCreditRole; via?: RecoTitleRef }
  | { kind: "theme"; theme: RecoThemeRef; via?: RecoTitleRef }
  | { kind: "company"; company: RecoCompanyRef; via?: RecoTitleRef }
  | { kind: "collection"; collection: RecoCollectionRef; via?: RecoTitleRef }
  | { kind: "origin"; language: string; country?: string; via?: RecoTitleRef }
  | { kind: "genre"; genre: RecoGenreRef }
  | { kind: "hiddenGem"; rating: number; votes: number }
  | { kind: "acclaimed"; rating: number; votes?: number }
  | { kind: "recent"; year: number }
  | { kind: "kindredViewers" }
  | { kind: "exploration" };

export type RecoWhyKind = RecoWhy["kind"];

/** Tous les `kind` connus de CE contrat — un client ignore les autres. */
export const RECO_WHY_KINDS = [
  "similarTo",
  "person",
  "theme",
  "company",
  "collection",
  "origin",
  "genre",
  "hiddenGem",
  "acclaimed",
  "recent",
  "kindredViewers",
  "exploration",
] as const satisfies readonly RecoWhyKind[];

/** Le garde du client : une raison d'un `kind` connu (un serveur plus récent peut en envoyer d'autres). */
export function isRecoWhy(value: unknown): value is RecoWhy {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && (RECO_WHY_KINDS as readonly string[]).includes(kind);
}

/** Bornes de `match` : un entier, en pourcentage. */
export const RECO_MATCH_MIN = 0;
export const RECO_MATCH_MAX = 100;

// ── La page servie ──────────────────────────────────────────────────────────

export interface RecoRowItem {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Visuel large TMDB (carrousel héros) — absent d'un vieux pool. */
  backdropPath?: string | null;
  /** null = hors bibliothèque : badge + navigation vers la fiche Vigie. */
  jellyfinItemId: string | null;
  source: string;
  score: number;
  voteAverage: number | null;
  reasons: RecoReason[];
  exploration?: boolean;
  /** Plateformes où le titre est inclus : null = inconnu, [] = aucune ; absent = vieux serveur. */
  providers?: RecoProviderRef[] | null;
  /** Les raisons de ce titre pour CE compte, la plus forte d'abord (1 à 3). Absent : `reasons`. */
  why?: RecoWhy[];
  /**
   * Correspondance estimée (entier 0..100) : la chance, selon le moteur, que
   * le titre plaise au compte — calibrée sur ce qu'il a aimé, pas un rang.
   * Absente : le moteur ne s'engage pas (profil trop mince, titre trop loin).
   */
  match?: number;
}

export interface RecoPageRow {
  /** Clé de la rangée. Celles d'une rangée à thème sont OPAQUES pour le client : son titre vient de `why`. */
  key: string;
  seedTitle?: string;
  items: RecoRowItem[];
  /** Ce que les titres de la rangée ont en commun — son titre se tire de là. Absent : titre par la clé. */
  why?: RecoWhy;
}

/** Le titre « à la une » : le meilleur pari du moteur, avec ses raisons et sa correspondance. */
export interface RecoFeatured {
  item: RecoRowItem;
  /** La rangée où il figure aussi ; absente : il n'est nulle part ailleurs sur la page. */
  rowKey?: string;
}

export interface RecoPage {
  state: RecoState;
  signalCount: number;
  generating: boolean;
  refining: boolean;
  exploring: boolean;
  /** Date de construction du snapshot servi. */
  generatedAt: string | null;
  poolGeneratedAt: string | null;
  tmdbConfigured: boolean;
  personalized: boolean;
  /** Le filtre appliqué (ids canonisés), null = toutes les plateformes. */
  filter: { providers: number[] } | null;
  /** Rangées AVEC leurs items — les vides sont omises. */
  rows: RecoPageRow[];
  /** Absent : rien à mettre à la une (ou serveur plus ancien) — le client garde son héros. */
  featured?: RecoFeatured;
}

/**
 * Paramètre de requête par lequel un client annonce qu'il sait titrer une
 * rangée par son `why` (`?themes=1`). Sans lui, le serveur ne sert que les
 * clés de rangées que les clients d'avant savent nommer — une rangée à thème
 * s'y appellerait « Pour vous ». Un serveur plus ancien l'ignore.
 */
export const RECO_PAGE_THEMES_PARAM = "themes";
