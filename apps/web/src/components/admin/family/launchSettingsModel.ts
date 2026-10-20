import {
  DEFAULT_FAMILY_LAUNCH_SETTINGS,
  FAMILY_LAUNCH_ASK_PLATFORMS,
  type FamilyLaunchAskPlatform,
  type FamilyLaunchPolicy,
  type FamilyLaunchSettings,
  type SetFamilyLaunchPolicyBody,
} from "@tentacle-tv/shared";

/**
 * « Qui regarde ? à l'ouverture » dans l'administration (serveur 1.31.1,
 * `family.launchPlatforms`) : un BROUILLON — l'interrupteur et les cases — que
 * « Enregistrer » écrit d'un coup. Module pur : `launchSettingsModel.test.ts`.
 */

/** La forme simple, telle que le serveur la RÉPOND (ses défauts s'il ne la dit pas encore). */
export function launchSettingsOf(policy: FamilyLaunchPolicy): FamilyLaunchSettings {
  return {
    enabled: policy.enabled ?? DEFAULT_FAMILY_LAUNCH_SETTINGS.enabled,
    platforms: { ...DEFAULT_FAMILY_LAUNCH_SETTINGS.platforms, ...policy.platforms },
  };
}

export function sameLaunchSettings(a: FamilyLaunchSettings, b: FamilyLaunchSettings): boolean {
  return a.enabled === b.enabled && FAMILY_LAUNCH_ASK_PLATFORMS.every((platform) => a.platforms[platform] === b.platforms[platform]);
}

export function togglePlatform(draft: FamilyLaunchSettings, platform: FamilyLaunchAskPlatform, on: boolean): FamilyLaunchSettings {
  return { ...draft, platforms: { ...draft.platforms, [platform]: on } };
}

/** Le corps du `PUT` : la forme simple, entière (aucun champ de la forme d'avant). */
export function launchSettingsBody(draft: FamilyLaunchSettings): SetFamilyLaunchPolicyBody {
  return { enabled: draft.enabled, platforms: { ...draft.platforms } };
}

/** Allumé sans aucune case cochée : la question ne s'afficherait nulle part — à dire. */
export function asksNowhere(draft: FamilyLaunchSettings): boolean {
  return draft.enabled && FAMILY_LAUNCH_ASK_PLATFORMS.every((platform) => !draft.platforms[platform]);
}
