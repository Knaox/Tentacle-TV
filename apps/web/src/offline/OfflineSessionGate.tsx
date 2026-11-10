/**
 * Garde de session hors ligne (desktop uniquement) : hors ligne, si la photo
 * locale de session est absente ou a dépassé ses 30 jours glissants, on ne
 * peut plus garantir la validité du compte → overlay « reconnexion
 * nécessaire ». Les données locales sont CONSERVÉES ; l'overlay disparaît de
 * lui-même au retour en ligne (la sonde revalide et le sync repousse le TTL).
 *
 * Fondu en CSS pur (keyframe globale `fadeIn`), jetons de thème seulement ; les boutons du socle.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, useUserId } from "@tentacle-tv/api-client";
import { useNavigate } from "react-router-dom";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { supportsOfflineSession } from "../desktop/bridge";
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
    if (!supportsOfflineSession() || !userId || !offline) {
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

  if (!supportsOfflineSession() || !offline || !expired) return null;

  const handleLogout = () => {
    // onSettled : la purge locale doit aboutir même si l'appel réseau de
    // déconnexion échoue — on est hors ligne par définition ici.
    logout.mutate(undefined, {
      onSettled: () => navigate("/login"),
    });
  };

  return (
    // Plein cadre, OPAQUE : rien ne se floute derrière une surface pleine.
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-surface-0" style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div className="flex max-w-md flex-col items-center gap-4 px-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-surface-2 text-content-secondary">
          <ClockCounterClockwiseIcon size={26} aria-hidden />
        </span>
        <h2 className="font-display text-heading-2 text-content-primary">{t("downloads:sessionExpiredTitle")}</h2>
        <p className="max-w-[52ch] text-sm leading-relaxed text-content-secondary">{t("downloads:sessionExpiredMessage")}</p>
        <div className="mt-3 flex flex-col items-stretch gap-2.5">
          <button type="button" onClick={() => probeNow(true)} className="btn btn-solid btn-lg min-w-[220px]">
            {t("downloads:offlineRetry")}
          </button>
          <button type="button" onClick={handleLogout} className="btn btn-danger min-w-[220px]">
            {t("common:offlineLogout")}
          </button>
        </div>
      </div>
    </div>
  );
}
