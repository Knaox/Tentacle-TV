import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FadeIn } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";

interface Props {
  delay?: number;
}

/**
 * La section « Sur cet appareil » du profil : « Mes titres hors ligne »
 * (« 12 titres · 1 en cours ») vers l'écran de gestion, et les réglages
 * hors ligne. Invisible sans droit ni contenu.
 */
export function OnDeviceSection({ delay = 320 }: Props) {
  const { t } = useTranslation("offline");
  const router = useRouter();
  const { visible } = useOfflineVisibility();
  const { active, total } = useOfflineActivity();
  if (!visible) return null;
  const parts = [t("countTitles", { count: total })];
  if (active > 0) parts.push(t("countActive", { count: active }));
  return (
    <FadeIn delay={delay}>
      <SettingsSection title={t("sectionOnDevice")}>
        <SettingsRow icon="smartphone" label={t("myOfflineTitles")} description={parts.join(" · ")} chevron onPress={() => router.push("/on-device")} />
        <SettingsRow icon="sliders" label={t("profileRowSettings")} chevron last onPress={() => router.push("/settings/on-device")} />
      </SettingsSection>
    </FadeIn>
  );
}
