import type { FamilyDesktopLaunchPolicy, PickerProfilesDto } from "./familyPickerContract";
import { pickerLaunch, type PickerLaunch } from "./familyPickerClient";
import { launchAskedByServer, pickerStayInitial, withDeviceChoice, type PickerDeviceChoice } from "./familyPickerDevice";
import { pickerStayState, type PickerStay } from "./familyPickerStay";
import { mobileMemoryKey } from "./familyMobileProfiles";

/**
 * « Qui regarde ? » à l'OUVERTURE du mobile (téléphone, tablette) — la règle
 * du bureau (`familyPickerDevice.ts`), par APPAREIL : décision de Damien du
 * 2026-10-21, après l'alpha. Proposé à CHAQUE démarrage à froid dès deux
 * profils ; la case « Ne plus proposer au démarrage » (ou Réglages › Compte)
 * fait ouvrir directement le dernier profil choisi. Module pur :
 * `familyMobileLaunch.test.ts`.
 *
 * Deux mémoires, par serveur et par compte :
 * - le DERNIER profil choisi (`MOBILE_PROFILE_STAY_KEY`, écrit à chaque choix,
 *   comme avant le 21/10) ;
 * - le CHOIX de l'appareil (`MOBILE_PROFILE_LAUNCH_KEY`) : `ask` (proposer),
 *   `stay` (ouvrir le dernier profil), absent (`unset`, jamais choisi).
 * Reprise de l'ancienne mémoire : un appareil qui retenait un profil hier n'a
 * pas encore de choix — `unset`, donc le nouveau défaut (proposer) ; le
 * profil retenu reste le « dernier choisi » qu'une case cochée rouvrira.
 *
 * L'administration décide si la plateforme `mobile` propose « Qui regarde ? »
 * D'OFFICE (serveur 1.31.1, capacité `family.launchPlatforms` :
 * `PickerProfilesDto.launchAsk`, lu par `mobileLaunchAsked`). Non : ni écran
 * à l'ouverture, ni case, ni réglage — « Changer de profil » reste, et une
 * session de profil gardée reprend. Un serveur sans la capacité : proposé
 * (le comportement du mobile avant elle). La `launchPolicy` de la liste est
 * celle des ordinateurs : jamais lue ici.
 */

/** Le choix de l'appareil, par serveur et par compte (`{ "<serveur>|<compte>": "ask" | "stay" }`).
 *  ⚠️ Clé traversée par une chaîne : jamais renommée. */
export const MOBILE_PROFILE_LAUNCH_KEY = "tentacle_mobile_profile_launch";

/**
 * L'administration fait-elle proposer « Qui regarde ? » d'office sur le
 * mobile ? Seulement lu sous la capacité `family.launchPlatforms` ; sans elle,
 * oui (le comportement d'avant).
 */
export function mobileLaunchAsked(listing: Partial<Pick<PickerProfilesDto, "launchAsk">>, capable: boolean): boolean {
  return capable ? launchAskedByServer(listing, true) : true;
}

/** La liste vue par la règle du bureau, dans le cadre du mobile (jamais `launchPolicy`, celle des ordinateurs). */
function framed<T extends Pick<PickerProfilesDto, "atLaunch">>(listing: T, asked: boolean): T & { launchPolicy: FamilyDesktopLaunchPolicy } {
  const launchPolicy: FamilyDesktopLaunchPolicy = { mode: asked ? "choice" : "off", defaultOn: true };
  return { ...listing, atLaunch: false, launchPolicy };
}

function readChoices(raw: string | null): Record<string, "ask" | "stay"> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, "ask" | "stay"] => entry[1] === "ask" || entry[1] === "stay"));
  } catch {
    return {};
  }
}

/** Le choix de cet appareil pour ce compte sur ce serveur ; illisible ou absent : `unset`. */
export function readMobileLaunchChoice(raw: string | null, serverUrl: string, accountId: string): PickerDeviceChoice {
  return readChoices(raw)[mobileMemoryKey(serverUrl, accountId)] ?? "unset";
}

/** La valeur à écrire ; `unset` efface. Les autres comptes et serveurs restent. */
export function writeMobileLaunchChoice(raw: string | null, serverUrl: string, accountId: string, choice: PickerDeviceChoice): string {
  const all = readChoices(raw);
  const key = mobileMemoryKey(serverUrl, accountId);
  if (choice === "unset") delete all[key];
  else all[key] = choice;
  return JSON.stringify(all);
}

/** Ce mobile PROPOSE-t-il « Qui regarde ? » au démarrage (l'interrupteur de Réglages › Compte) ? */
export function mobileProposesAtLaunch(choice: PickerDeviceChoice): boolean {
  return choice !== "stay";
}

/**
 * Au démarrage à froid : `picker` (« Qui regarde ? » plein écran), `resume`
 * (la session de profil que l'app garde) ou `personal` (le compte). La règle
 * du bureau (`pickerLaunch`) dans le cadre du mobile : le dernier profil
 * choisi ne dispense de l'écran que si l'appareil ne propose plus (`stay`),
 * qu'il vaut encore ET qu'il est le profil en cours d'après le serveur —
 * jamais le compte ouvert sans son code parce que la session d'un enfant a
 * pris fin. `held` : le profil dont l'app garde le jeton, ou null. `asked` :
 * `mobileLaunchAsked` — non, l'écran ne vient que pour une session sans jeton.
 */
export function mobileProfileLaunch(
  listing: Pick<PickerProfilesDto, "atLaunch" | "pickerRequired" | "currentProfileId" | "account" | "profiles">,
  held: { profileId: string } | null,
  choice: PickerDeviceChoice,
  lastPicked: PickerStay | null,
  now: number,
  asked = true,
): PickerLaunch {
  const usable = asked && choice === "stay" && lastPicked !== null && pickerStayState(listing, lastPicked, now) !== "stale" ? lastPicked : null;
  return pickerLaunch(withDeviceChoice(framed(listing, asked), choice), held, usable, now);
}

/** La case « Ne plus proposer au démarrage » à l'arrivée sur l'écran : cochée si l'appareil ne propose déjà plus. */
export function mobileStayInitial(
  listing: Pick<PickerProfilesDto, "profiles" | "atLaunch">,
  choice: PickerDeviceChoice,
  lastPicked: PickerStay | null,
  now: number,
  asked = true,
): boolean {
  return pickerStayInitial(framed(listing, asked), choice, lastPicked, now);
}
