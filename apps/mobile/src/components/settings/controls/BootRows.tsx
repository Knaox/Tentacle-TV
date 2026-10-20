import { useTranslation } from "react-i18next";
import { useBootSettings } from "@/screens/profile/bootEntryHooks";
import { BrandSwitch } from "../BrandSwitch";
import type { SettingScope } from "../ScopeBadge";
import { SettingsRow } from "../SettingsRow";
import { SwitchSettingRow } from "./SettingRowKit";

interface RowProps {
  scope: SettingScope | null;
  last?: boolean;
}

/** « Animation d'ouverture » — réglage de CET appareil ; jamais avec « Réduire les animations » du système. */
export function BootIntroRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const { intro } = useBootSettings();
  return (
    <SwitchSettingRow
      icon="play" label={t("boot.intro")} description={t("boot.introHint")}
      scope={scope} value={intro.value} onChange={intro.set} last={last}
    />
  );
}

/** « Son au démarrage » — grisé quand l'animation est coupée : il n'a alors rien à accompagner. */
export function BootSoundRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const { intro, sound } = useBootSettings();
  return (
    <SettingsRow
      icon="volume-2"
      label={t("boot.sound")}
      description={t("boot.soundHint")}
      scope={scope ?? undefined}
      disabled={!intro.value}
      last={last}
      trailing={<BrandSwitch value={sound.value} onValueChange={sound.set} disabled={!intro.value} accessibilityLabel={t("boot.sound")} />}
    />
  );
}
