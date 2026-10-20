import { useBootIntroSetting, useBootSoundSetting } from "@/bootIntro/bootIntroSettings";

/**
 * Ce que les réglages lisent de l'OUVERTURE animée du logo — l'ADAPTATEUR vers
 * les réglages de la session « ouverture-mobile » (lot du 2026-10-20), BRANCHÉ :
 * `useBootIntroSetting()` et `useBootSoundSetting()` dans
 * `bootIntro/bootIntroSettings.ts` (→ `[value, set]`, clés `tentacle_boot_intro`
 * et `tentacle_boot_sound`, « 0 » = coupé, allumés par défaut).
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

export function useBootSettings(): BootSettings {
  const [intro, setIntro] = useBootIntroSetting();
  const [sound, setSound] = useBootSoundSetting();
  return { available: true, intro: { value: intro, set: setIntro }, sound: { value: sound, set: setSound } };
}
