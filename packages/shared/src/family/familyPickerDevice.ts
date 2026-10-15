import type { FamilyDesktopLaunchPolicy, PickerProfilesDto } from "./familyPickerContract";
import { pickerStayState, type PickerStay } from "./familyPickerStay";

/**
 * « Qui regarde ? » à l'ouverture du BUREAU se décide par APPAREIL (serveur
 * 1.30.0, `family.pickerPolicy`) : chaque ordinateur garde SON choix, dans le
 * cadre que l'administration lui donne (`PickerProfilesDto.launchPolicy`).
 * Module pur : `familyPickerDevice.test.ts`.
 *
 * Trois états, gardés sur la machine (par serveur et par compte) :
 * - `unset` : jamais choisi — le défaut de l'administration (`defaultOn`) ;
 * - `ask` : cet ordinateur propose « Qui regarde ? » ;
 * - `stay` : il ne le propose plus, et ouvre le profil retenu
 *   (`familyPickerStay.ts`, « Ne plus proposer à la prochaine ouverture »).
 * Coupé par l'administration (`off`) : jamais, quel que soit le choix gardé —
 * qui revient s'il le rouvre. L'ancienne préférence du COMPTE n'y entre plus.
 */
export type PickerDeviceChoice = "unset" | "ask" | "stay";

/** Un serveur d'avant la 1.30.0 ne dit rien : permis, activé par défaut. */
const LEGACY_POLICY: FamilyDesktopLaunchPolicy = { mode: "choice", defaultOn: true };

export function desktopLaunchPolicy(listing: Partial<Pick<PickerProfilesDto, "launchPolicy">>): FamilyDesktopLaunchPolicy {
  return listing.launchPolicy ?? LEGACY_POLICY;
}

/** L'administration permet-elle « Qui regarde ? » à l'ouverture des ordinateurs ? */
export function launchAllowed(listing: Partial<Pick<PickerProfilesDto, "launchPolicy">>): boolean {
  return desktopLaunchPolicy(listing).mode !== "off";
}

/** Cet ordinateur PROPOSE-t-il « Qui regarde ? » à l'ouverture ? */
export function deviceProposes(listing: Partial<Pick<PickerProfilesDto, "launchPolicy">>, choice: PickerDeviceChoice): boolean {
  if (!launchAllowed(listing) || choice === "stay") return false;
  return choice === "ask" || desktopLaunchPolicy(listing).defaultOn;
}

/**
 * La liste telle que la porte, le sélecteur et le réglage la lisent :
 * `atLaunch` y devient la règle de CET ordinateur — vrai s'il propose, ou s'il
 * retient un profil (l'exception du profil retenu en décide ensuite :
 * `stayOverridesPicker`) ; faux s'il est coupé, ou jamais choisi sous un
 * défaut désactivé. Ne lit que `launchPolicy` : réappliquée, elle rend la même.
 */
export function withDeviceChoice<T extends Pick<PickerProfilesDto, "atLaunch"> & Partial<Pick<PickerProfilesDto, "launchPolicy">>>(
  listing: T,
  choice: PickerDeviceChoice,
): T {
  const atLaunch = launchAllowed(listing) && (choice === "stay" || deviceProposes(listing, choice));
  return listing.atLaunch === atLaunch ? listing : { ...listing, atLaunch };
}

/**
 * La case « Ne plus proposer à la prochaine ouverture » à l'arrivée sur « Qui
 * regarde ? » — à l'ouverture comme depuis « Changer de profil » : cochée si
 * cet ordinateur ne propose déjà plus (un profil retenu encore valable, ou
 * jamais choisi sous un défaut désactivé), sinon décochée. Un profil retenu
 * disparu, ou dont le code a changé d'état, ne compte plus (il sera oublié).
 */
export function pickerStayInitial(
  listing: Pick<PickerProfilesDto, "profiles"> & Partial<Pick<PickerProfilesDto, "launchPolicy">>,
  choice: PickerDeviceChoice,
  stay: PickerStay | null,
  now: number,
): boolean {
  if (choice === "stay" && stay && pickerStayState(listing, stay, now) !== "stale") return true;
  return !deviceProposes(listing, choice === "stay" ? "unset" : choice);
}
