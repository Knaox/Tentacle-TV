import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";
import { useServerReachable } from "../hooks/useServerReachable";
import { isTauriApp } from "../main";

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
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0a0a0f]/95 backdrop-blur-md"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="flex flex-col items-center px-8 text-center">
        <CryingTentacle size={160} />
        <h2 className="mt-8 text-2xl font-bold text-white">
          {t("offlineTitle")}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
          {t("offlineMessage")}
        </p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-white/35">
          {t("offlineHint")}
        </p>
        {/* Boutons alignés sur le design system (Hero Play/More Info) :
            rayon rounded-md, scale-[1.03] au hover, var(--brand) au lieu
            de raw hex, mêmes paddings horizontaux pour une largeur cohérente. */}
        <button
          onClick={retry}
          className="mt-8 inline-flex min-w-[220px] items-center justify-center rounded-md px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "var(--brand)",
            boxShadow: "0 8px 30px rgba(139,92,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.10)",
          }}
        >
          {t("retryConnection")}
        </button>
        <button
          onClick={handleLogout}
          className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-md border border-red-500/40 bg-red-500/12 px-7 py-3 text-sm font-semibold text-red-300 backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:bg-red-500/20 active:scale-[0.98]"
        >
          {t("offlineLogout")}
        </button>
        {isTauriApp && (
          <button
            onClick={handleChangeServer}
            className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-md border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-white/80 backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:bg-white/10 active:scale-[0.98]"
          >
            {t("changeServer")}
          </button>
        )}
      </div>
    </div>
  );
}
