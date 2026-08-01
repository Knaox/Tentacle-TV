import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";
import { useServerReachable } from "../hooks/useServerReachable";
import { isDesktopApp } from "../desktop/bridge";

interface OfflineBannerProps {
  /** Si true, recharge la page quand le serveur revient (mode backendDown initial) */
  reloadOnReconnect?: boolean;
}

/**
 * Overlay plein écran affiché quand le serveur est injoignable.
 * Se masque automatiquement quand la connexion revient.
 */
export function OfflineBanner({ reloadOnReconnect = false }: OfflineBannerProps) {
  const { t } = useTranslation("common");
  const { isReachable, retry } = useServerReachable();
  const { logout, changeServer } = useAuth();
  const navigate = useNavigate();
  const wasOfflineRef = useRef(false);

  // Reload la page quand le serveur revient après un backendDown initial
  useEffect(() => {
    if (!isReachable) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && reloadOnReconnect) {
      window.location.reload();
    }
  }, [isReachable, reloadOnReconnect]);

  if (isReachable) return null;

  // Reload the page afterwards — the OfflineBanner renders at App root when
  // backendDown is true, short-circuiting the router. Without a reload, calling
  // navigate("/login") leaves the banner visible and the user feels stuck.
  // onSettled (pas onSuccess) : la purge locale doit aboutir même si l'appel
  // réseau de déconnexion échoue — le backend est off par définition ici.
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        if (reloadOnReconnect) window.location.reload();
        else navigate("/login");
      },
    });
  };

  const handleChangeServer = () => {
    changeServer.mutate(undefined, {
      onSettled: () => window.location.reload(),
    });
  };

  return (
    <div
      // Fond plein écran : littéral hors table (implémentation ad hoc) — non migré.
      className="fixed inset-0 z-[999] flex items-center justify-center bg-surface-modal backdrop-blur-md"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="flex flex-col items-center px-8 text-center">
        <CryingTentacle size={160} />
        <h2 className="mt-8 text-2xl font-bold text-content-primary">
          {t("offlineTitle")}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-content-tertiary">
          {t("offlineMessage")}
        </p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-content-quaternary">
          {t("offlineHint")}
        </p>
        {/* Boutons alignés sur le design system : CTA primaire = bouton blanc
            (même style que le Play de la fiche média), secondaires en ghost. */}
        <button
          onClick={retry}
          className="mt-8 inline-flex min-w-[220px] items-center justify-center rounded-md bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg transition-all duration-200 hover:scale-[1.03] hover:bg-cta-primary-bg-hover active:scale-[0.98]"
        >
          {t("retryConnection")}
        </button>
        <button
          onClick={handleLogout}
          className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-md border border-danger-border bg-danger-surface px-7 py-3 text-sm font-semibold text-status-error-fg backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:bg-danger-surface active:scale-[0.98]"
        >
          {t("offlineLogout")}
        </button>
        {isDesktopApp() && (
          <button
            onClick={handleChangeServer}
            className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-md border border-line-strong bg-fill-subtle px-7 py-3 text-sm font-semibold text-content-secondary backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:bg-fill-soft active:scale-[0.98]"
          >
            {t("changeServer")}
          </button>
        )}
      </div>
    </div>
  );
}
