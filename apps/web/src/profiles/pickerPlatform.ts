import type { FamilyPickerPlatform, ServerCapability } from "@tentacle-tv/shared";
import { isDesktopApp } from "../desktop/detect";

/**
 * « Qui regarde ? » hors des TV, d'après la COQUILLE — le seul endroit où le
 * bureau et le navigateur diffèrent (docs/FAMILLE.md, « Le web ») :
 *
 * - le bureau (`desktop`, `family.desktopProfiles`, 1.30.0) garde lui-même le
 *   jeton du compte le temps d'un profil — aucune page tierce ne lit son stockage ;
 * - le navigateur (`web`, `family.webProfiles`, 1.32.0) s'authentifie par
 *   cookie : c'est le SERVEUR qui met le jeton du compte en réserve (httpOnly) et
 *   le rend derrière son code — la page n'en garde jamais de copie, et ses appels
 *   de « Qui regarde ? » partent avec les cookies, sans Bearer. Un serveur d'avant
 *   refuse la plateforme `web` : jamais un profil à moitié ouvert.
 *
 * Tout le reste — écrans, PIN, gestion derrière son code, photos d'invités,
 * droits — est le MÊME code pour les deux.
 */

const desktop = isDesktopApp();

export const PICKER_PLATFORM: FamilyPickerPlatform = desktop ? "desktop" : "web";

/** La capacité qui ouvre « Qui regarde ? » à cette coquille. */
export const PICKER_CAPABILITY: ServerCapability = desktop ? "family.desktopProfiles" : "family.webProfiles";

/** Le serveur garde le jeton du compte pendant un profil (le navigateur). */
export const ACCOUNT_HELD_BY_SERVER = !desktop;

/** Les mots de l'appareil : « ce navigateur » plutôt que « cet ordinateur ». */
export const IN_BROWSER = !desktop;
