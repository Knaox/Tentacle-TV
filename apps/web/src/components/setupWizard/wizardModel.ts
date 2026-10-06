import type { ExistingLibrary, LibraryPlan, SetupContext } from "@tentacle-tv/shared";

/**
 * La règle de l'assistant d'installation, sans React : quels écrans, dans quel
 * ordre, où reprendre après un rechargement, et ce qu'on propose d'office.
 *
 * Une question par écran. Les étapes s'adaptent à l'installation détectée :
 * la base n'est demandée que si la pile ne la fournit pas ; un Jellyfin vierge
 * se configure (le compte est CRÉÉ), un Jellyfin déjà configuré se rejoint (le
 * compte est VÉRIFIÉ), ou par une clé collée (le compte est demandé à la fin).
 */
export type WizardStep =
  | "welcome"
  | "code"
  | "database"
  | "jellyfin"
  | "account"
  | "locale"
  | "libraries"
  | "finalAccount"
  | "recap"
  | "apply"
  | "remote"
  | "done";

/** `initialize` : Jellyfin vierge (ou voisin verrouillé) ; `connect` : compte existant ; `key` : clé collée. */
export type JellyfinMode = "initialize" | "connect" | "key";

export interface WizardPlan {
  needsDatabase: boolean;
  mode: JellyfinMode | null;
  /** Le mot de passe n'est plus en mémoire (clé collée, ou reprise après rechargement). */
  askFinalAccount: boolean;
}

export function wizardSteps(plan: WizardPlan): WizardStep[] {
  return [
    "welcome",
    "code",
    ...(plan.needsDatabase ? (["database"] as const) : []),
    "jellyfin",
    "account",
    "locale",
    "libraries",
    ...(plan.askFinalAccount || plan.mode === "key" ? (["finalAccount"] as const) : []),
    "recap",
    "apply",
    "remote",
    "done",
  ];
}

/** On ne revient pas en arrière depuis ces écrans : ce qu'ils ont fait est fait. */
export const NO_BACK: ReadonlySet<WizardStep> = new Set(["welcome", "apply", "remote", "done"]);

/** La base est à demander : pas fournie par l'environnement, et pas encore reliée. */
export function needsDatabase(context: SetupContext | null): boolean {
  return !!context && !context.database.fromEnv && !context.database.connected;
}

/**
 * Où reprendre une installation déjà commencée (session retrouvée). Le voisin
 * de la pile complète, verrouillé au démarrage, porte déjà la clé de Tentacle
 * (`configured`) mais attend encore le compte choisi (`claimed`) : on passe
 * par Jellyfin, pas par-dessus.
 */
export function resumeStep(context: SetupContext): WizardStep {
  if (needsDatabase(context)) return "database";
  if (!context.jellyfin.configured || context.jellyfin.claimed) return "jellyfin";
  return "libraries";
}

/** Jellyfin est à configurer avec le compte choisi : vierge, ou voisin verrouillé en attente. */
export function jellyfinNeedsInitialize(context: SetupContext | null): boolean {
  return !context || !context.jellyfin.configured || context.jellyfin.claimed;
}

const LANGUAGES = ["fr", "en", "de", "it", "es", "pt", "nl"] as const;
export const METADATA_LANGUAGES: readonly string[] = LANGUAGES;
export const METADATA_COUNTRIES: readonly string[] = ["FR", "CH", "BE", "LU", "CA", "US", "GB", "DE", "IT", "ES", "PT", "NL"];

const DEFAULT_COUNTRY: Record<string, string> = { fr: "FR", en: "US", de: "DE", it: "IT", es: "ES", pt: "PT", nl: "NL" };
/** La culture d'interface de Jellyfin, par langue — des cultures qu'il connaît. */
const UI_CULTURE: Record<string, string> = { fr: "fr", en: "en-US", de: "de", it: "it", es: "es", pt: "pt-PT", nl: "nl" };

export interface WizardLocale {
  language: string;
  country: string;
}

/** La langue et le pays proposés d'office : ceux du navigateur, s'ils sont connus. */
export function defaultLocale(browserLanguage: string | undefined): WizardLocale {
  const [lang = "", region = ""] = (browserLanguage ?? "").split("-");
  const language = (METADATA_LANGUAGES as string[]).includes(lang.toLowerCase()) ? lang.toLowerCase() : "en";
  const country = METADATA_COUNTRIES.includes(region.toUpperCase()) ? region.toUpperCase() : DEFAULT_COUNTRY[language];
  return { language, country };
}

export function uiCultureOf(language: string): string {
  return UI_CULTURE[language] ?? "en-US";
}

/** Le nom devient un dossier chez Jellyfin : la même règle que le serveur. */
const LIBRARY_NAME = /^[^\s/\\:*?"<>|](?:[^/\\:*?"<>|]*[^\s/\\:*?"<>|])?$/;

export function isValidLibraryName(name: string): boolean {
  return name.length > 0 && name.length <= 64 && LIBRARY_NAME.test(name);
}

/**
 * Les bibliothèques proposées : dans la pile complète, « Films » et « Séries »
 * sur les dossiers que le service `init` a créés — sauf celles qui existent déjà.
 */
export function defaultLibraries(
  context: SetupContext | null,
  existing: readonly ExistingLibrary[],
  names: { movies: string; tvshows: string },
): LibraryPlan[] {
  const folders = context?.mediaFolders;
  if (!folders) return [];
  const taken = new Set(existing.flatMap((library) => library.paths));
  const plans: LibraryPlan[] = [
    { name: names.movies, type: "movies", paths: [folders.movies] },
    { name: names.tvshows, type: "tvshows", paths: [folders.tvshows] },
  ];
  return plans.filter((plan) => !plan.paths.some((path) => taken.has(path)));
}

/** Les chemins de l'hôte où déposer les médias (pile complète), d'après le dossier monté et les sous-dossiers. */
export function hostMediaPaths(context: SetupContext | null): string[] {
  const root = context?.mediaHostPath?.replace(/\/+$/, "");
  const folders = context?.mediaFolders;
  if (!root || !folders) return [];
  const sub = (path: string) => path.slice(folders.root.length).replace(/^\/+/, "");
  return [folders.movies, folders.tvshows].map((path) => `${root}/${sub(path)}`);
}

/** Le code d'installation glissé dans le lien des journaux (`/setup#code=…`). */
export function codeFromHash(hash: string): string | null {
  const match = hash.match(/(?:^#|&)code=([0-9A-Za-z-]{12,20})(?:&|$)/);
  return match ? match[1].toUpperCase() : null;
}
