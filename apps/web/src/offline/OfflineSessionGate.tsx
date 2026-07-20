/**
 * Garde de session hors ligne (desktop uniquement) : hors ligne, si la photo
 * locale de session est absente ou a dépassé ses 30 jours glissants, on ne
 * peut plus garantir la validité du compte → overlay « reconnexion
 * nécessaire ». Les données locales sont CONSERVÉES ; l'overlay disparaît de
 * lui-même au retour en ligne (la sonde revalide et le sync repousse le TTL).
 *
 * Animations en CSS pur (keyframe globale `fadeIn`), tokens de thème only.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, useUserId } from "@tentacle-tv/api-client";
import { useNavigate } from "react-router-dom";
import { isTauriApp } from "../main";
import { useConnectivity } from "./useConnectivity";
import { getCachedSession } from "./offlineSession";
import { probeNow } from "./connectivityStore";

export function OfflineSessionGate() {
  const { t } = useTranslation(["downloads", "common"]);
  const userId = useUserId();
  const { state } = useConnectivity();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const offline = state === "offline-auto" || state === "offline-manual";
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!isTauriApp || !userId || !offline) {
      setExpired(false);
      return;
    }
    let cancelled = false;
    void getCachedSession(userId).then((entry) => {
      if (!cancelled) setExpired(entry === null || entry.expired);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, offline]);

  if (!isTauriApp || !offline || !expired) return null;

  const handleLogout = () => {
    // onSettled : la purge locale doit aboutir même si l'appel réseau de
    // déconnexion échoue — on est hors ligne par définition ici.
    logout.mutate(undefined, {
      onSettled: () => navigate("/login"),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-surface-modal backdrop-blur-md"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="flex max-w-md flex-col items-center px-8 text-center">
        <h2 className="text-2xl font-bold text-content-primary">
          {t("downloads:sessionExpiredTitle")}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-content-tertiary">
          {t("downloads:sessionExpiredMessage")}
        </p>
        <button
          onClick={() => probeNow(true)}
          className="mt-8 inline-flex min-w-[220px] items-center justify-center rounded-md bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg transition-colors duration-200 hover:bg-cta-primary-bg-hover"
        >
          {t("downloads:offlineRetry")}
        </button>
        <button
          onClick={handleLogout}
          className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-md border border-danger-border bg-danger-surface px-7 py-3 text-sm font-semibold text-status-error-fg transition-colors duration-200 hover:bg-danger-surface-hover"
        >
          {t("common:offlineLogout")}
        </button>
      </div>
    </div>
  );
}
