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
 *    administrateur, et c'est tout. Aucun compte créé, aucune bibliothèque
 *    créée ni choisie : celles qui existent sont montrées, en lecture seule,
 *    avec les réglages conseillés (facultatifs).
 *
 * Les deux ont la même longueur : le numéro d'étape est juste avant même le
 * choix. Changer de Jellyfin (retour à « Jellyfin ») recalcule le parcours.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/setup/`, comme les
 * autres fichiers du contrat (`setupWizardMirror.test.ts`). Aucun import.
 */

/** Les écrans de l'assistant. */
export type SetupStep =
  | "welcome"
  | "code"
  | "database"
  | "jellyfin"
  | "account"
  | "libraries"
  | "signIn"
  | "recommended"
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
}

/** Ce que le serveur tient du parcours (`SetupContext.flow`). */
export interface SetupFlowState {
  /** La base reste à relier : ni fournie par l'environnement, ni connectée. */
  databasePending: boolean;
  /** `null` : aucun Jellyfin choisi — l'étape « Jellyfin » est la prochaine. */
  selection: SetupSelection | null;
  /** Tentacle tient la clé du Jellyfin choisi, au nom du compte administrateur choisi. */
  linked: boolean;
}

/** Ce qui fixe la liste des écrans. */
export interface SetupFlowShape {
  /** Ce navigateur doit donner le code d'installation. */
  needsCode: boolean;
  /** La base n'est pas fournie par l'environnement : son écran est dans le parcours. */
  asksDatabase: boolean;
  /** `null` : pas encore de Jellyfin choisi. */
  path: SetupPath | null;
}

const PATH_STEPS: Readonly<Record<SetupPath, readonly SetupStep[]>> = {
  fresh: ["account", "libraries"],
  configured: ["signIn", "recommended"],
};
const TAIL: readonly SetupStep[] = ["recap", "apply", "remote", "done"];

function head(shape: SetupFlowShape): SetupStep[] {
  return ["welcome", ...(shape.needsCode ? (["code"] as const) : []), ...(shape.asksDatabase ? (["database"] as const) : []), "jellyfin"];
}

/** Les écrans du parcours, dans l'ordre. Sans Jellyfin choisi : jusqu'à « Jellyfin » seulement. */
export function setupFlowSteps(shape: SetupFlowShape): SetupStep[] {
  return shape.path ? [...head(shape), ...PATH_STEPS[shape.path], ...TAIL] : head(shape);
}

/** Le nombre d'écrans, le même pour les deux parcours : connu avant le choix. */
export function setupFlowLength(shape: SetupFlowShape): number {
  return head(shape).length + PATH_STEPS.fresh.length + TAIL.length;
}

/** Le premier écran d'un parcours, juste après le choix du Jellyfin. */
export function pathEntry(path: SetupPath): SetupStep {
  return PATH_STEPS[path][0];
}

/** Les écrans propres à un parcours : jamais montrés dans l'autre. */
export function pathOnlySteps(path: SetupPath): readonly SetupStep[] {
  return PATH_STEPS[path];
}

/** Le parcours d'un Jellyfin sondé : neuf (ou verrouillé par Tentacle en attendant) ou déjà configuré. */
export function pathForServer(server: { blank: boolean }): SetupPath {
  return server.blank ? "fresh" : "configured";
}

/** L'étape où en est le serveur : où reprendre l'installation. */
export function setupStage(state: SetupFlowState): SetupStep {
  if (state.databasePending) return "database";
  if (!state.selection) return "jellyfin";
  if (!state.linked) return pathEntry(state.selection.path);
  return PATH_STEPS[state.selection.path][1];
}

/** On ne revient pas en arrière depuis ces écrans : ce qu'ils ont fait est fait. */
export const SETUP_NO_BACK: ReadonlySet<SetupStep> = new Set<SetupStep>(["welcome", "apply", "remote", "done"]);

/** L'écran d'avant, DANS le parcours ; `null` : pas de retour. */
export function previousStep(steps: readonly SetupStep[], step: SetupStep): SetupStep | null {
  const index = steps.indexOf(step);
  if (index <= 0 || SETUP_NO_BACK.has(step)) return null;
  return steps[index - 1];
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
 *  - `browse`, `createLibraries` : parcourir les dossiers, CRÉER des bibliothèques — Jellyfin neuf seulement ;
 *  - `readLibraries` : lire les bibliothèques existantes ;
 *  - `advice` : les réglages conseillés — Jellyfin déjà configuré seulement ;
 *  - `segments` : la détection des passages ;
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
      return path === "fresh" && state.linked;
    case "advice":
      return path === "configured" && state.linked;
    case "verify":
    case "readLibraries":
    case "segments":
    case "complete":
      return state.linked;
  }
}
