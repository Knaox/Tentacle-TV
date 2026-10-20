import { mobileProfileLaunch, mobileStayIsStale, type PickerDeviceChoice, type PickerProfilesDto, type PickerStay } from "@tentacle-tv/shared";

/**
 * La porte de « Qui regarde ? » à l'ouverture du mobile — module PUR (testé
 * sous vitest), lu par `ProfileLaunchGate`.
 *
 * - `none` : rien à montrer (pas de capacité, hors ligne, seul dans la
 *   famille, « Ne plus proposer au démarrage » sur un profil qui vaut, serveur
 *   muet — l'app reste comme avant) ;
 * - `pending` : la famille n'a pas encore répondu ;
 * - `picker` : « Qui regarde ? » plein écran.
 *
 * `request` : une session de profil a pris fin — « Qui regarde ? » exigé,
 * quoi que dise le choix de l'appareil. `choice` : ce choix (règle partagée
 * `familyMobileLaunch.ts`) ; `stay` : le dernier profil choisi. Une erreur de lecture ne bloque jamais l'app.
 */
export type LaunchGateState = "none" | "pending" | "picker";

export interface LaunchGateInput {
  enabled: boolean;
  data: PickerProfilesDto | undefined;
  isError: boolean;
  request: string | null;
  held: { profileId: string } | null;
  choice: PickerDeviceChoice;
  stay: PickerStay | null;
  now: number;
  /** L'administration le propose d'office sur le mobile (`mobileLaunchAsked`). */
  asked: boolean;
}

export function launchGateState(input: LaunchGateInput): LaunchGateState {
  if (!input.enabled) return "none";
  if (!input.data) return input.isError ? "none" : "pending";
  if (input.request !== null && input.data.pickerRequired) return "picker";
  return mobileProfileLaunch(input.data, input.held, input.choice, input.stay, input.now, input.asked) === "picker" ? "picker" : "none";
}

/** Le choix retenu est à oublier (profil disparu, code posé ou retiré). */
export function launchStayToForget(input: Pick<LaunchGateInput, "data" | "stay" | "now">): boolean {
  return !!input.data && mobileStayIsStale(input.data, input.stay, input.now);
}

/** La décision de l'ouverture, figée par compte pour la vie du processus. */
export interface LaunchDecision {
  account: string | null;
  show: boolean;
}

/**
 * La décision suivante — UNE par compte et par démarrage à froid : la liste
 * qui se relit (retour d'arrière-plan, `family:update`) ne rouvre jamais
 * l'écran ; seule une fin de session de profil (`request`) le rouvre, et un
 * autre compte décide pour lui. `pending` : rien n'est encore décidé.
 */
export function nextLaunchDecision(
  previous: LaunchDecision | null,
  input: { state: LaunchGateState; account: string | null; request: string | null },
): LaunchDecision | null {
  if (input.state === "pending") return previous;
  if (input.request !== null && input.state === "picker") return { account: input.account, show: true };
  if (previous && previous.account === input.account) return previous;
  return { account: input.account, show: input.state === "picker" };
}
