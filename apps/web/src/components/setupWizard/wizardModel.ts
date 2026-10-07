import {
  pathEntry,
  pathOnlySteps,
  setupFlowLength,
  setupFlowSteps,
  setupStage,
  type ExistingLibrary,
  type LibraryPlan,
  type SetupContext,
  type SetupFlowShape,
  type SetupPath,
  type SetupSelection,
  type SetupStep,
} from "@tentacle-tv/shared";

/**
 * La règle de l'assistant d'installation côté client, sans React. Le PARCOURS
 * n'est pas décidé ici : il vient du serveur (`SetupContext.flow`), par la
 * machine partagée (`setupFlowContract.ts`) — le client affiche les écrans
 * du parcours en cours, dans l'ordre, et n'en montre aucun autre.
 *
 * Une question par écran. Le code n'est demandé qu'à un navigateur qui
 * n'arrive pas directement du réseau local ; la base n'est demandée que si la
 * pile ne la fournit pas ; le choix du Jellyfin n'est JAMAIS sauté. Jellyfin
 * neuf : le compte est CRÉÉ, puis les bibliothèques. Jellyfin déjà
 * configuré : on s'y CONNECTE, puis les réglages conseillés — rien n'y est créé.
 */
export type WizardStep = SetupStep;

/** Ce que le client sait de l'installation, pour la liste des écrans. */
export interface WizardShapeInput {
  needsCode: boolean;
  context: SetupContext | null;
}

/**
 * La base a son écran quand l'environnement ne la fournit pas — reliée ou non : il fait partie du parcours.
 * La clé TMDB, quand le serveur la déclare (un serveur d'avant cet écran ne le servirait pas).
 */
export function flowShape({ needsCode, context }: WizardShapeInput): SetupFlowShape {
  return {
    needsCode,
    asksDatabase: !!context && !context.database.fromEnv,
    path: pathOf(context),
    noLibraries: context?.flow.noLibraries ?? false,
    asksTmdb: context?.flow.tmdb !== undefined,
  };
}

export function wizardSteps(input: WizardShapeInput): WizardStep[] {
  return setupFlowSteps(flowShape(input));
}

export function wizardLength(input: WizardShapeInput): number {
  return setupFlowLength(flowShape(input));
}

/** Le parcours fixé par le serveur ; `null` tant qu'aucun Jellyfin n'est choisi. */
export function pathOf(context: SetupContext | null): SetupPath | null {
  return context?.flow.selection?.path ?? null;
}

export function selectionOf(context: SetupContext | null): SetupSelection | null {
  return context?.flow.selection ?? null;
}

/** La base est à demander : pas fournie par l'environnement, et pas encore reliée. */
export function needsDatabase(context: SetupContext | null): boolean {
  return !!context && !context.database.fromEnv && !context.database.connected;
}

/**
 * Où reprendre une installation commencée (session ouverte, page rechargée) :
 * l'étape du serveur. Relié, mais sans le mot de passe en mémoire (il n'est
 * jamais gardé) : le premier écran du parcours, qui le redemande.
 */
export function resumeStep(context: SetupContext, hasCredentials: boolean): WizardStep {
  const stage = setupStage(context.flow);
  const path = pathOf(context);
  if (path && context.flow.linked && !hasCredentials) return pathEntry(path);
  return stage;
}

/** Les écrans où le Jellyfin choisi est rappelé en tête : ceux du parcours, jusqu'à l'installation. */
export function showsChosenServer(step: WizardStep, path: SetupPath | null, noLibraries = false): boolean {
  return !!path && (pathOnlySteps(path, noLibraries).includes(step) || step === "recap" || step === "apply");
}

/** Le Jellyfin choisi n'avait aucune bibliothèque à la connexion (déjà configuré) : en créer est facultatif. */
export function createsLibraries(context: SetupContext | null): boolean {
  return pathOf(context) === "fresh" || context?.flow.noLibraries === true;
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
 * Les bibliothèques proposées : « Films » et « Séries » — sauf celles qui
 * existent déjà. Dans la pile complète, sur les dossiers que le service
 * `init` a créés ; ailleurs (un autre Jellyfin ne voit pas ces dossiers),
 * sans dossier : l'administrateur choisit lui-même les siens.
 */
export function defaultLibraries(
  context: SetupContext | null,
  existing: readonly ExistingLibrary[],
  names: { movies: string; tvshows: string },
  inStack = true,
): LibraryPlan[] {
  const folders = inStack ? context?.mediaFolders : null;
  const takenPaths = new Set(existing.flatMap((library) => library.paths));
  const takenNames = new Set(existing.map((library) => library.name.toLowerCase()));
  const plans: LibraryPlan[] = [
    { name: names.movies, type: "movies", paths: folders ? [folders.movies] : [] },
    { name: names.tvshows, type: "tvshows", paths: folders ? [folders.tvshows] : [] },
  ];
  return plans.filter((plan) => !takenNames.has(plan.name.toLowerCase()) && !plan.paths.some((path) => takenPaths.has(path)));
}

/** Les bibliothèques sans dossier choisi : le bouton « Continuer » attend. */
export function plansMissingFolder(plans: readonly LibraryPlan[]): LibraryPlan[] {
  return plans.filter((plan) => plan.paths.length === 0);
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
