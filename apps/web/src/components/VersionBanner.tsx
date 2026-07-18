import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useServerCompat } from "../hooks/useServerCompat";
import { getUserInfo } from "./userMenu/menuItems";

/**
 * Bannière d'avertissement affichée UNIQUEMENT à l'admin quand le serveur
 * Tentacle TV est plus ancien que cette application (risque de dysfonctionnement).
 * Masquable, mais l'état de masquage n'est gardé qu'en mémoire → la bannière
 * réapparaît au prochain démarrage de l'app.
 *
 * Test (dev uniquement) — dans la console : `tentacleTestVersionBanner()` pour
 * forcer l'affichage, `tentacleTestVersionBanner(false)` pour le masquer.
 */
export function VersionBanner() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  const { serverVersion, incompatible } = useServerCompat();
  const [dismissed, setDismissed] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).tentacleTestVersionBanner = (show = true) => setForced(!!show);
    return () => { delete (window as unknown as Record<string, unknown>).tentacleTestVersionBanner; };
  }, []);

  if (!isAdmin || dismissed || !(forced || incompatible)) return null;

  return (
    <div
      role="alert"
      // border-amber-500/40 : pas de token "border-status-warning" autorisé pour
      // cette famille — laissé en dur (cf. rapport). amber-200/100 plus bas :
      // hiérarchie de teintes volontaire, hors granularité de status-warning-fg.
      className="relative z-30 flex items-start gap-3 border-y border-amber-500/40 bg-status-warning-bg px-4 py-3 text-sm md:px-8"
    >
      <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 003.19 21h17.62a1.5 1.5 0 001.3-2.59l-8.4-14.55a1.5 1.5 0 00-2.62 0z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-200">{t("serverOutdatedTitle")}</p>
        <p className="mt-0.5 text-amber-100/80">{t("serverOutdatedMessage", { server: serverVersion ?? "?" })}</p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("serverOutdatedDismiss")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-amber-200/70 transition-colors hover:bg-amber-500/20 hover:text-amber-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
