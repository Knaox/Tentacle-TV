/**
 * Octave (mobile) — ce que l'axe `o2` (hub « Compte ») branche dans la coquille : le hub (`account`), ouvert par
 * l'avatar en tête des pages, et « Gérer les profils » DANS Octave (`profiles` : la page Famille de Tentacle).
 * Seul `o2` édite ce fichier.
 */

import { OctaveAccountScreen } from "../../account/OctaveAccountScreen";
import { OctaveProfilesRoute } from "../../account/OctaveProfilesRoute";
import type { OctaveAxisContribution } from "../octaveRegistryTypes";

export const o2Contribution: OctaveAxisContribution = {
  screens: { account: OctaveAccountScreen, profiles: OctaveProfilesRoute },
};
