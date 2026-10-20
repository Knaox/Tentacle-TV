/**
 * Ce que les réglages lisent de l'OUVERTURE animée du logo — l'ADAPTATEUR vers
 * les réglages de la session « ouverture-mobile » (lot du 2026-10-20) :
 * `useBootIntroSetting()` et `useBootSoundSetting()` dans
 * `bootIntro/bootIntroSettings.ts` (→ `[value, set]`, clés `tentacle_boot_intro`
 * et `tentacle_boot_sound`, « 0 » = coupé, allumés par défaut). Tant qu'ils ne
 * sont pas fusionnés, ce module répond « indisponible » : le groupe « Ouverture »
 * ne paraît pas — jamais une erreur.
 */

export interface BootSetting {
  value: boolean;
  set: (next: boolean) => void;
}

export interface BootSettings {
  /** L'ouverture animée existe dans ce binaire. */
  available: boolean;
  intro: BootSetting;
  sound: BootSetting;
}

const OFF: BootSetting = { value: false, set: () => undefined };
const UNAVAILABLE: BootSettings = { available: false, intro: OFF, sound: OFF };

export function useBootSettings(): BootSettings {
  return UNAVAILABLE;
}
