import { FIRST_RUN_STEP_IDS, type FirstRunStep } from "./firstRunCatalog";

/**
 * Le PREMIER LANCEMENT d'un profil hors TV (mobile, iPad, web étroit) — ce
 * qu'il montre, d'après le catalogue (`firstRunCatalog.ts`) : l'ordre de la TV
 * (tv-core `nav/startupWindows`), une fois par profil et par appareil
 * (`FIRST_RUN_SEEN_KEY`), chaque étape se passe. Module PUR.
 */

/** `["<serveur>|<profil>", …]` — les profils qui ont vu leur premier lancement ici. ⚠️ Clé stockée : jamais renommée. */
export const FIRST_RUN_SEEN_KEY = "tentacle_first_run_seen";

export type { FirstRunStep } from "./firstRunCatalog";

export interface FirstRunInput {
  /** Le profil actif (le compte, ou le profil de la session de profil) ; null : pas de session. */
  subjectId: string | null;
  serverUrl: string | null;
  online: boolean;
  /** Les profils déjà passés ici (`FIRST_RUN_SEEN_KEY`). */
  seen: readonly string[];
  /** Le code PIN conseillé : vrai, faux, ou null tant que la Famille n'a pas répondu. */
  pinDue: boolean | null;
  /** L'accueil du compte est lisible (la préférence a répondu) ; null tant qu'on ne sait pas. */
  homeReady: boolean | null;
  /** La photo à proposer (règle partagée `avatarInvite`) ; null tant que la photo du profil n'est pas sue. */
  photoDue: boolean | null;
}

export type FirstRunPlan =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "show"; steps: FirstRunStep[] };

export function firstRunKey(serverUrl: string, subjectId: string): string {
  return `${serverUrl.replace(/\/+$/, "").toLowerCase()}|${subjectId.replace(/-/g, "").toLowerCase()}`;
}

export function parseFirstRunSeen(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** La liste à écrire une fois le premier lancement vu (terminé ou passé). */
export function withFirstRunSeen(seen: readonly string[], key: string): string[] {
  return seen.includes(key) ? [...seen] : [...seen, key];
}

/**
 * Ce que montre le premier lancement : rien (déjà vu, hors ligne — rien n'est
 * marqué, il reviendra —, ou aucune étape), l'attente (une réponse manque), ou
 * ses étapes dans l'ordre de la TV. Une étape inconnue ne retient jamais : la
 * décision attend seulement ce qui peut changer la liste.
 */
export function firstRunPlan(input: FirstRunInput): FirstRunPlan {
  if (!input.subjectId || !input.serverUrl || !input.online) return { kind: "none" };
  if (input.seen.includes(firstRunKey(input.serverUrl, input.subjectId))) return { kind: "none" };
  if (input.pinDue === null || input.homeReady === null || input.photoDue === null) return { kind: "pending" };
  const due: Record<FirstRunStep, boolean> = { pinSetup: input.pinDue, homeRows: input.homeReady, photoSetup: input.photoDue };
  const steps = FIRST_RUN_STEP_IDS.filter((step) => due[step]);
  return steps.length > 0 ? { kind: "show", steps } : { kind: "none" };
}
