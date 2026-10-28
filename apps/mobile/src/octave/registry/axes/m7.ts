/**
 * Octave (mobile) — ce que l'axe `m7` branche dans la coquille : « Réglages d'Octave » (`settings`). Les profils
 * passent par « Changer de profil » (la feuille de Tentacle, d'où l'on gère aussi la famille) : pas d'écran à part.
 * Seul `m7` édite ce fichier.
 */

import { OctaveSettingsRoute } from "../../settings/view/OctaveSettingsRoute";
import type { OctaveAxisContribution } from "../octaveRegistryTypes";

export const m7Contribution: OctaveAxisContribution = {
  screens: { settings: OctaveSettingsRoute },
};
