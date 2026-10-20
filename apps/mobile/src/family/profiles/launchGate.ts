import { mobileProfileLaunch, mobileStayIsStale, type PickerProfilesDto, type PickerStay } from "@tentacle-tv/shared";

/**
 * La porte de « Qui regarde ? » à l'ouverture du mobile — module PUR (testé
 * sous vitest), lu par `ProfileLaunchGate`.
 *
 * - `none` : rien à montrer (pas de capacité, hors ligne, seul dans la
 *   famille, choix retenu qui vaut, serveur muet — l'app reste comme avant) ;
 * - `pending` : la famille n'a pas encore répondu ;
 * - `picker` : « Qui regarde ? » plein écran.
 *
 * `request` : une session de profil a pris fin — « Qui regarde ? » exigé,
 * quoi que dise le choix retenu. Une erreur de lecture ne bloque jamais l'app.
 */
export type LaunchGateState = "none" | "pending" | "picker";

export interface LaunchGateInput {
  enabled: boolean;
  data: PickerProfilesDto | undefined;
  isError: boolean;
  request: string | null;
  held: { profileId: string } | null;
  stay: PickerStay | null;
  now: number;
}

export function launchGateState(input: LaunchGateInput): LaunchGateState {
  if (!input.enabled) return "none";
  if (!input.data) return input.isError ? "none" : "pending";
  if (input.request !== null && input.data.pickerRequired) return "picker";
  return mobileProfileLaunch(input.data, input.held, input.stay, input.now) === "picker" ? "picker" : "none";
}

/** Le choix retenu est à oublier (profil disparu, code posé ou retiré). */
export function launchStayToForget(input: Pick<LaunchGateInput, "data" | "stay" | "now">): boolean {
  return !!input.data && mobileStayIsStale(input.data, input.stay, input.now);
}
