import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";
import { useServerReachable } from "../hooks/useServerReachable";

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
  const { logout } = useAuth();
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

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
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
        <button
          onClick={retry}
          className="mt-8 rounded-xl bg-[#8b5cf6] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#7c3aed] hover:scale-105 active:scale-95"
        >
          {t("retryConnection")}
        </button>
        <button
          onClick={handleLogout}
          className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 px-8 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/25 hover:scale-105 active:scale-95"
        >
          {t("offlineLogout")}
        </button>
      </div>
    </div>
  );
}
