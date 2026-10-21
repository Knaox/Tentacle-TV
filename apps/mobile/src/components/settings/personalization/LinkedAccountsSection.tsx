import { useTranslation } from "react-i18next";
import {
  useCreateTmdbGuestSession, useExternalAccounts, useResyncRatings, useUnlinkTmdbGuestSession,
} from "@tentacle-tv/api-client";
import { SettingsRow, SettingsSection } from "@/components/settings";

/**
 * Section « Comptes liés », comme sur le web : la session invitée TMDB (les
 * notes posées depuis le téléphone partent ANONYMEMENT — la phrase le dit),
 * puis l'état de la file de synchronisation des notes et sa relance. Sans clé
 * TMDB sur le serveur, la ligne le dit au lieu d'offrir un geste qui échouera.
 * Préférences du COMPTE : une seule session, partagée entre les appareils.
 */
export function LinkedAccountsSection() {
  const { t } = useTranslation("preferences");
  const { data } = useExternalAccounts();
  const createGuest = useCreateTmdbGuestSession();
  const unlinkGuest = useUnlinkTmdbGuestSession();
  const resync = useResyncRatings();

  if (!data) return null;
  const { tmdb, sync } = data;
  const tmdbHint = tmdb.configured
    ? `${t("persoTmdbHint")}${tmdb.linked ? `\n${t("persoTmdbLinked")}` : ""}`
    : t("persoTmdbUnavailable");
  const syncHint = t("persoSyncCounts", { synced: sync.synced, pending: sync.pending, failed: sync.failed })
    + (sync.failed > 0 ? `\n${t("persoSyncFailedHint")}` : "");

  return (
    <SettingsSection title={t("persoAccountsTitle")} caption={t("persoAccountsCaption")}>
      <SettingsRow icon="globe" label={t("persoTmdbTitle")} description={tmdbHint} />
      {tmdb.configured && (
        <SettingsRow
          icon={tmdb.linked ? "link-2" : "link"}
          label={tmdb.linked ? t("persoUnlink") : t("persoTmdbCreate")}
          accent={!tmdb.linked}
          destructive={tmdb.linked}
          disabled={createGuest.isPending || unlinkGuest.isPending}
          onPress={() => (tmdb.linked ? unlinkGuest.mutate() : createGuest.mutate())}
        />
      )}
      <SettingsRow icon="star" label={t("persoSyncTitle")} description={syncHint} />
      <SettingsRow
        icon="refresh-cw"
        label={t("persoSyncNow")}
        accent
        last
        disabled={resync.isPending}
        onPress={() => resync.mutate()}
      />
    </SettingsSection>
  );
}
