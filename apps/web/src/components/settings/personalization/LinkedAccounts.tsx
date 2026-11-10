import { useTranslation } from "react-i18next";
import {
  useCreateTmdbGuestSession,
  useExternalAccounts,
  useResyncRatings,
  useUnlinkTmdbGuestSession,
} from "@tentacle-tv/api-client";
import { SettingItem } from "../wide/SettingItem";
import { SubSetting } from "../SubSetting";
import { SETTING_BUTTON } from "../wide/settingButtons";

/**
 * Réglages › Compte et sécurité › Comptes liés (elle vivait dans
 * « Personnalisation », où on ne cherche pas un compte) : guest session TMDB (les notes partent
 * ANONYMEMENT — l'explication est affichée) et état de la file de sync avec
 * resynchronisation manuelle. Le bloc indisponible (clé TMDB absente du
 * serveur) le dit au lieu de proposer un bouton qui échouera.
 */
export function LinkedAccounts() {
  const { t } = useTranslation("preferences");
  const { data } = useExternalAccounts();
  const createGuest = useCreateTmdbGuestSession();
  const unlinkGuest = useUnlinkTmdbGuestSession();
  const resync = useResyncRatings();

  if (!data) return null;

  return (
    <SettingItem setting="linkedAccounts">
      <div className="flex flex-col gap-4">
        {/* TMDB — guest session anonyme */}
        <SubSetting
          title={t("persoTmdbTitle")}
          hint={(
            <>
              {data.tmdb.configured ? t("persoTmdbHint") : t("persoTmdbUnavailable")}
              {data.tmdb.linked && <span className="mt-1 block font-medium text-status-success-fg">{t("persoTmdbLinked")}</span>}
            </>
          )}
          trailing={data.tmdb.configured ? (
            <button
              type="button"
              onClick={() => (data.tmdb.linked ? unlinkGuest.mutate() : createGuest.mutate())}
              disabled={createGuest.isPending || unlinkGuest.isPending}
              className={SETTING_BUTTON}
            >
              {data.tmdb.linked ? t("persoUnlink") : t("persoTmdbCreate")}
            </button>
          ) : undefined}
        />

        {/* État de la file de sync */}
        <div className="border-t border-line-subtle pt-4">
          <SubSetting
            title={t("persoSyncTitle")}
            hint={(
              <>
                <span className="num">
                  {t("persoSyncCounts", { synced: data.sync.synced, pending: data.sync.pending, failed: data.sync.failed })}
                </span>
                {data.sync.failed > 0 && <span className="mt-1 block text-status-error-fg">{t("persoSyncFailedHint")}</span>}
              </>
            )}
            trailing={(
              <button type="button" onClick={() => resync.mutate()} disabled={resync.isPending} className={SETTING_BUTTON}>
                {t("persoSyncNow")}
              </button>
            )}
          />
        </div>
      </div>
    </SettingItem>
  );
}
