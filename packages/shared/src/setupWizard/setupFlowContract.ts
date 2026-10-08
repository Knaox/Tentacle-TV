/**
 * Le PARCOURS de l'assistant d'installation : une machine à états pure, la
 * même pour le serveur (qui la fait respecter : tout geste hors parcours est
 * refusé, quoi que fasse le client) et pour le client (qui l'affiche : les
 * écrans, leur numéro, le retour en arrière).
 *
 * Deux parcours, fixés par le Jellyfin CHOISI — jamais sauté, jamais choisi
 * d'office — et décidés par le serveur, qui sonde ce Jellyfin :
 *
 *  - `fresh` (Jellyfin NEUF, son propre assistant pas encore fait — ou celui
 *    de la pile, verrouillé par Tentacle en attendant) : le compte
 *    administrateur est CRÉÉ, puis de vraies bibliothèques JELLYFIN
 *    (`/Library/VirtualFolders`) ;
 *  - `configured` (Jellyfin DÉJÀ configuré) : on se CONNECTE avec son
 *    administrateur. Aucun compte créé ; ses bibliothèques sont montrées, en
 *    lecture seule, avec les réglages conseillés (facultatifs). Une seule
 *    exception : un Jellyfin configuré mais SANS AUCUNE bibliothèque à la
 *    connexion (`noLibraries`, constaté par le serveur) reçoit l'écran des
 *    bibliothèques, entre la connexion et les réglages — en créer y est
 *    FACULTATIF.
 *
 * Puis, dans les deux, la clé TMDB (`tmdb`) — FACULTATIVE : « Configurer
 * plus tard » la laisse vide, et l'avis « Aucune clé TMDB » ne relance plus
 * l'administrateur créé ici (la recommandation du tableau de bord reste).
 * Un serveur d'avant cet écran ne le déclare pas (`SetupFlowState.tmdb`
 * absent) : pas d'écran.
 *
 * Les deux ont la même longueur jusqu'à la connexion : le numéro d'étape est
 * juste avant même le choix. Le Jellyfin configuré trouvé vide en gagne un
 * (l'écran des bibliothèques), dit dès qu'on le sait. Changer de Jellyfin
 * (retour à « Jellyfin ») recalcule le parcours.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/setup/`, comme les
 * autres fichiers du contrat (`setupWizardMirror.test.ts`). Aucun import.
 */

/** Les écrans de l'assistant. */
export type SetupStep =
  | "welcome"
  | "code"
  | "jellyfin"
  | "account"
  | "libraries"
  | "signIn"
  | "recommended"
  | "tmdb"
  | "recap"
  | "apply"
  | "remote"
  | "done";

/** Le parcours, selon le Jellyfin choisi. */
export type SetupPath = "fresh" | "configured";

/** Le Jellyfin choisi à l'étape « Jellyfin », tel que le serveur l'a sondé. */
export interface SetupSelection {
  /** L'adresse par laquelle le SERVEUR le joint (l'adresse interne, pour celui de la pile). */
  url: string;
  serverId: string;
  serverName: string;
  version: string;
  /** Le Jellyfin de la pile complète. */
  inStack: boolean;
  path: SetupPath;
  /**
   * Déjà configuré, mais SANS AUCUNE bibliothèque quand on s'y est connecté
   * (constaté par le serveur à la connexion, gardé jusqu'au prochain choix).
   * Absent : il en avait, ou on ne s'y est pas encore connecté.
   */
  noLibraries?: boolean;
}

/** La clé TMDB, telle que le serveur la tient pendant l'installation. Jamais la clé elle-même. */
export interface SetupTmdbState {
  /** Une clé est en place : saisie (base) ou fournie par l'environnement. */
  configured: boolean;
  /** `env` : la variable `TMDB_API_KEY`, prioritaire — rien à saisir. */
  source: "env" | "db" | null;
  /** Ses quatre derniers caractères, pour la reconnaître. */
  last4: string | null;
  /** « Configurer plus tard » choisi : à la fin, l'avis `tmdbKey` est masqué pour l'administrateur. */
  later: boolean;
}

/** Ce que le serveur tient du parcours (`SetupContext.flow`). */
export interface SetupFlowState {
  /**
   * Vrai : la base du serveur ne s'ouvre pas (indisponible, ou MariaDB en
   * attente de migration vers SQLite) — aucun geste n'est permis, et
   * l'assistant reste à l'accueil (`setupStage` → `welcome`). Depuis SQLite
   * (1.25), il n'y a plus de base à relier : plus d'écran pour elle. Champ
   * GARDÉ sur le réseau : les assistants d'avant 1.25 le lisent.
   */
  databasePending: boolean;
  /** `null` : aucun Jellyfin choisi — l'étape « Jellyfin » est la prochaine. */
  selection: SetupSelection | null;
  /** Tentacle tient la clé du Jellyfin choisi, au nom du compte administrateur choisi. */
  linked: boolean;
  /**
   * Le Jellyfin choisi est déjà configuré, relié, et n'avait AUCUNE
   * bibliothèque à la connexion : l'écran des bibliothèques est dans son
   * parcours, et en créer y est permis. Absent (serveur d'avant) : non.
   */
  noLibraries?: boolean;
  /** La clé TMDB. Absent (serveur d'avant l'écran TMDB) : l'écran n'est pas dans le parcours. */
  tmdb?: SetupTmdbState;
}

/** Ce qui fixe la liste des écrans. */
export interface SetupFlowShape {
  /** Ce navigateur doit donner le code d'installation. */
  needsCode: boolean;
  /** `null` : pas encore de Jellyfin choisi. */
  path: SetupPath | null;
  /** Jellyfin configuré trouvé sans bibliothèque (`SetupFlowState.noLibraries`). */
  noLibraries?: boolean;
  /** Le serveur connaît l'écran TMDB (`SetupFlowState.tmdb` présent). */
  asksTmdb?: boolean;
}

const PATH_STEPS: Readonly<Record<SetupPath, readonly SetupStep[]>> = {
  fresh: ["account", "libraries"],
  configured: ["signIn", "recommended"],
};
/** Le Jellyfin configuré mais vide : on propose ses bibliothèques avant les réglages. */
const CONFIGURED_EMPTY: readonly SetupStep[] = ["signIn", "libraries", "recommended"];

function pathSteps(path: SetupPath, noLibraries: boolean | undefined): readonly SetupStep[] {
  return path === "configured" && noLibraries ? CONFIGURED_EMPTY : PATH_STEPS[path];
}
const TAIL: readonly SetupStep[] = ["recap", "apply", "remote", "done"];

/** La fin du parcours : la clé TMDB (si le serveur la propose), puis le récapitulatif. */
function tail(shape: SetupFlowShape): SetupStep[] {
  return [...(shape.asksTmdb ? (["tmdb"] as const) : []), ...TAIL];
}

function head(shape: SetupFlowShape): SetupStep[] {
  return ["welcome", ...(shape.needsCode ? (["code"] as const) : []), "jellyfin"];
}

/** Les écrans du parcours, dans l'ordre. Sans Jellyfin choisi : jusqu'à « Jellyfin » seulement. */
export function setupFlowSteps(shape: SetupFlowShape): SetupStep[] {
  return shape.path ? [...head(shape), ...pathSteps(shape.path, shape.noLibraries), ...tail(shape)] : head(shape);
}

/**
 * Le nombre d'écrans : le même pour les deux parcours, connu avant le choix —
 * un de plus pour le Jellyfin configuré trouvé vide, une fois connecté.
 */
export function setupFlowLength(shape: SetupFlowShape): number {
  const middle = shape.path ? pathSteps(shape.path, shape.noLibraries).length : PATH_STEPS.fresh.length;
  return head(shape).length + middle + tail(shape).length;
}

/** Le premier écran d'un parcours, juste après le choix du Jellyfin. */
export function pathEntry(path: SetupPath): SetupStep {
  return PATH_STEPS[path][0];
}

/** Les écrans propres à un parcours (vide ou non, pour le configuré). */
export function pathOnlySteps(path: SetupPath, noLibraries?: boolean): readonly SetupStep[] {
  return pathSteps(path, noLibraries);
}

/** Le parcours d'un Jellyfin sondé : neuf (ou verrouillé par Tentacle en attendant) ou déjà configuré. */
export function pathForServer(server: { blank: boolean }): SetupPath {
  return server.blank ? "fresh" : "configured";
}

/** L'étape où en est le serveur : où reprendre l'installation. Base fermée : l'accueil, rien d'autre. */
export function setupStage(state: SetupFlowState): SetupStep {
  if (state.databasePending) return "welcome";
  if (!state.selection) return "jellyfin";
  if (!state.linked) return pathEntry(state.selection.path);
  return pathSteps(state.selection.path, state.noLibraries)[1];
}

/** On ne revient pas en arrière depuis ces écrans : ce qu'ils ont fait est fait. */
export const SETUP_NO_BACK: ReadonlySet<SetupStep> = new Set<SetupStep>(["welcome", "apply", "remote", "done"]);

/** L'ouverture de la session : une fois passée, on n'y revient pas (le code a servi). */
const SESSION_STEPS: ReadonlySet<SetupStep> = new Set<SetupStep>(["welcome", "code"]);

/** L'écran d'avant, DANS le parcours ; `null` : pas de retour. */
export function previousStep(steps: readonly SetupStep[], step: SetupStep): SetupStep | null {
  const index = steps.indexOf(step);
  if (index <= 0 || SETUP_NO_BACK.has(step)) return null;
  const previous = steps[index - 1];
  // Du code à l'accueil, oui (rien n'est encore ouvert) ; d'après la session, non.
  if (SESSION_STEPS.has(previous) && step !== "code") return null;
  return previous;
}

/** L'écran d'après, DANS le parcours ; `null` : le dernier, ou un écran hors parcours. */
export function nextStep(steps: readonly SetupStep[], step: SetupStep): SetupStep | null {
  const index = steps.indexOf(step);
  return index < 0 || index === steps.length - 1 ? null : steps[index + 1];
}

/**
 * Les gestes de l'assistant que le serveur garde par le parcours :
 *
 *  - `select` : choisir le Jellyfin (et recalculer le parcours) ;
 *  - `initialize` : CRÉER le compte administrateur — Jellyfin neuf seulement ;
 *  - `connect` : se connecter avec l'administrateur existant — Jellyfin déjà configuré seulement ;
 *  - `verify` : revérifier le compte (après un rechargement, le mot de passe n'est plus en mémoire) ;
 *  - `browse`, `createLibraries` : parcourir les dossiers, CRÉER des bibliothèques — Jellyfin neuf,
 *    ou déjà configuré mais trouvé SANS bibliothèque à la connexion (`noLibraries`) ;
 *  - `readLibraries` : lire les bibliothèques existantes ;
 *  - `advice` : les réglages conseillés — Jellyfin déjà configuré seulement ;
 *  - `segments` : la détection des passages ;
 *  - `tmdb` : enregistrer la clé TMDB (validée par TMDB), ou « Configurer plus tard » ;
 *  - `complete` : finir l'installation.
 */
export type SetupAction =
  | "select"
  | "initialize"
  | "connect"
  | "verify"
  | "browse"
  | "createLibraries"
  | "readLibraries"
  | "advice"
  | "segments"
  | "tmdb"
  | "complete";

/** Le geste appartient-il au parcours en cours ? Le serveur refuse tout le reste (`step_refused`). */
export function setupActionAllowed(action: SetupAction, state: SetupFlowState): boolean {
  if (state.databasePending) return false;
  const path = state.selection?.path ?? null;
  switch (action) {
    case "select":
      return true;
    case "initialize":
      return path === "fresh" && !state.linked;
    case "connect":
      return path === "configured";
    case "browse":
    case "createLibraries":
      return state.linked && (path === "fresh" || (path === "configured" && state.noLibraries === true));
    case "advice":
      return path === "configured" && state.linked;
    case "verify":
    case "readLibraries":
    case "segments":
    case "tmdb":
    case "complete":
      return state.linked;
  }
}

/**
 * `POST /api/setup/jellyfin/select` — le Jellyfin choisi, d'un geste de
 * l'administrateur. Le serveur le sonde et en tire le parcours ; la réponse
 * est le contexte à jour (`SetupContext`). Un autre Jellyfin que celui choisi
 * avant : ce qui avait été préparé pour l'ancien est oublié.
 */
export interface JellyfinSelectRequest {
  url: string;
}

/**
 * `POST /api/setup/jellyfin/verify` — le compte administrateur du Jellyfin
 * relié, revérifié (rechargement de la page : le mot de passe n'est jamais
 * gardé). Rien n'est créé ni changé.
 */
export interface JellyfinVerifyRequest {
  username: string;
  password: string;
}

/**
 * `POST /api/setup/tmdb` — la clé TMDB (v3), validée par TMDB avant d'être
 * enregistrée (la même vérification que l'administration), ou « Configurer
 * plus tard ». La réponse est le contexte à jour (`SetupContext`).
 */
export type SetupTmdbRequest = { apiKey: string } | { later: true };
