import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings";
import { useAdminSessions } from "@/hooks/admin/useAdminSessions";

/**
 * L'entrée du tableau de bord dans le profil d'un administrateur, avec ce
 * qu'il y trouvera : « 2 lectures » — un seul instantané, sans relève.
 */
export function AdminSessionsRow() {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const { data } = useAdminSessions(false);
  const playing = data?.sessions.filter((s) => s.nowPlaying !== null).length;
  return (
    <SettingsRow
      icon="activity"
      label={t("title")}
      description={playing === undefined ? undefined : t("playingCount", { count: playing })}
      chevron
      onPress={() => router.push("/admin/sessions")}
    />
  );
}
