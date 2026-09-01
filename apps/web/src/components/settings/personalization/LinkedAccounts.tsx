import { useTranslation } from "react-i18next";
import {
  useAnilistAuthorizeUrl,
  useCreateTmdbGuestSession,
  useExternalAccounts,
  useResyncRatings,
  useUnlinkAnilist,
  useUnlinkTmdbGuestSession,
} from "@tentacle-tv/api-client";
import { SettingsSection } from "@tentacle-tv/ui";

/**
 * Section « Comptes liés » : guest session TMDB (les notes partent
 * ANONYMEMENT — l'explication est affichée), liaison OAuth AniList, état de
 * la file de sync avec resynchronisation manuelle. Les blocs indisponibles
 * (clé TMDB ou client AniList absents du serveur) le disent au lieu de
 * proposer un bouton qui échouera.
 */
export function LinkedAccounts() {
  const { t } = useTranslation("preferences");
  const { data } = useExternalAccounts();
  const createGuest = useCreateTmdbGuestSession();
  const unlinkGuest = useUnlinkTmdbGuestSession();
  const authorizeUrl = useAnilistAuthorizeUrl();
  const unlinkAnilist = useUnlinkAnilist();
  const resync = useResyncRatings();

  if (!data) return null;

  const linkAnilist = () => {
    authorizeUrl.mutate(undefined, {
      onSuccess: ({ url }) => {
        // Navigation de premier niveau : le state à usage unique authentifie
        // le retour, aucune session n'a besoin de suivre (desktop compris).
        window.open(url, "_blank", "noopener");
      },
    });
  };

  return (
    <SettingsSection title={t("persoAccountsTitle")} caption={t("persoAccountsCaption")}>
      <div className="flex flex-col gap-5 p-5">
        {/* TMDB — guest session anonyme */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-content-primary">{t("persoTmdbTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {data.tmdb.configured ? t("persoTmdbHint") : t("persoTmdbUnavailable")}
            </p>
            {data.tmdb.linked && (
              <p className="mt-1 text-xs text-status-success">{t("persoTmdbLinked")}</p>
            )}
          </div>
          {data.tmdb.configured && (
            <button
              type="button"
              onClick={() => (data.tmdb.linked ? unlinkGuest.mutate() : createGuest.mutate())}
              disabled={createGuest.isPending || unlinkGuest.isPending}
              className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
            >
              {data.tmdb.linked ? t("persoUnlink") : t("persoTmdbCreate")}
            </button>
          )}
        </div>

        {/* AniList — OAuth par compte */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-content-primary">{t("persoAnilistTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {data.anilist.available ? t("persoAnilistHint") : t("persoAnilistUnavailable")}
            </p>
            {data.anilist.linked && (
              <p className="mt-1 text-xs text-status-success">{t("persoAnilistLinked")}</p>
            )}
          </div>
          {data.anilist.available && (
            <button
              type="button"
              onClick={() => (data.anilist.linked ? unlinkAnilist.mutate() : linkAnilist())}
              disabled={authorizeUrl.isPending || unlinkAnilist.isPending}
              className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
            >
              {data.anilist.linked ? t("persoUnlink") : t("persoAnilistLink")}
            </button>
          )}
        </div>

        {/* État de la file de sync */}
        <div className="border-t border-line-subtle pt-4">
          <p className="text-sm font-medium text-content-primary">{t("persoSyncTitle")}</p>
          <p className="mt-1 text-xs text-content-tertiary">
            {t("persoSyncCounts", {
              synced: data.sync.synced,
              pending: data.sync.pending,
              failed: data.sync.failed,
            })}
          </p>
          {data.sync.failed > 0 && (
            <p className="mt-1 text-xs text-status-error">{t("persoSyncFailedHint")}</p>
          )}
          <button
            type="button"
            onClick={() => resync.mutate()}
            disabled={resync.isPending}
            className="mt-3 rounded-full border border-line-strong px-4 py-1.5 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            {t("persoSyncNow")}
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
