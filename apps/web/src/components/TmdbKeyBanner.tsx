import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAdminMetadataStatus } from "@tentacle-tv/api-client";
import { getUserInfo } from "./userMenu/menuItems";

const METADATA_PATH = "/admin/metadata";

/**
 * Bandeau, pour les seuls administrateurs, quand aucune clé TMDB n'est posée :
 * sans elle, les recommandations restent génériques pour TOUS les comptes —
 * ni « Pour vous », ni profil de goût, ni filtre par plateforme — et personne
 * d'autre que l'admin ne peut y remédier. Les utilisateurs normaux ne voient
 * rien, nulle part. Masquable en mémoire (il revient au prochain démarrage,
 * comme VersionBanner) ; absent sur la page qui règle le problème.
 *
 * Essai (développement seulement) — dans la console :
 * `tentacleTestTmdbKeyBanner()` force l'affichage, `(false)` le retire.
 */
export function TmdbKeyBanner() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [forced, setForced] = useState(false);
  const { data } = useAdminMetadataStatus({ enabled: isAdmin });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.tentacleTestTmdbKeyBanner = (show = true) => setForced(!!show);
    return () => { delete w.tentacleTestTmdbKeyBanner; };
  }, []);

  const missing = data?.tmdb.configured === false;
  if (!isAdmin || dismissed || pathname.startsWith(METADATA_PATH) || !(forced || missing)) return null;

  return (
    <div
      // Informationnel, pas une panne : pas de role="alert". Teintes ambre de
      // VersionBanner (hors granularité des tokens status-warning, cf. rapport).
      className="relative z-30 flex items-start gap-3 border-y border-amber-500/40 bg-status-warning-bg px-4 py-3 text-sm md:px-8"
    >
      <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 003.19 21h17.62a1.5 1.5 0 001.3-2.59l-8.4-14.55a1.5 1.5 0 00-2.62 0z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-200">{t("tmdbKeyTitle")}</p>
        <p className="mt-0.5 text-amber-100/80">{t("tmdbKeyMessage")}</p>
        <Link
          to={METADATA_PATH}
          className="mt-2 inline-flex items-center rounded-full border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
        >
          {t("tmdbKeyAction")}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("tmdbKeyDismiss")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-amber-200/70 transition-colors hover:bg-amber-500/20 hover:text-amber-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
