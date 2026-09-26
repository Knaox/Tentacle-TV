import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import type { AdminSessionsSnapshotDto } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { SettingsRow } from "../settings/ui/SettingsRow";

/**
 * `AdminSessionsRow` de l'app : l'entrée du tableau de bord des sessions,
 * avec ce qu'on y trouvera — « 2 lectures ». Un seul instantané, sans relève
 * (le hook web `useAdminSessions` relit toutes les 3 s : c'est la page qui en
 * a besoin, pas la ligne). Clé distincte : ses données n'ont pas l'horloge.
 */
export function AdminSessionsRow() {
  const { t } = useTranslation("sessions");
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["admin", "sessions", "profile-count"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND}/api/admin/sessions`, { headers: hdrs(), credentials: creds() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as AdminSessionsSnapshotDto;
    },
    staleTime: 30_000,
    retry: false,
  });
  const playing = data?.sessions.filter((s) => s.nowPlaying !== null).length;
  return (
    <SettingsRow
      icon={Activity}
      label={t("title")}
      description={playing === undefined ? undefined : t("playingCount", { count: playing })}
      chevron
      onPress={() => navigate("/admin/sessions")}
    />
  );
}
