import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { OfflineBanner } from "@/components/OfflineBanner";
import { cachedSession } from "./sessionPhoto";
import { useOfflineMode } from "./useOfflineMode";
import { useOfflineVeilActions } from "./useOfflineVeilActions";

/** La photo peut expirer pendant l'usage : on la relit sans attendre une navigation. */
const RECHECK_MS = 60_000;

/**
 * La garde de session hors ligne. La photo de session (profil, droits) vaut
 * 30 jours glissants, repoussés à chaque passage en ligne ; passé ce délai
 * sans contact avec le serveur, le compte ne peut plus être tenu pour valide
 * et un voile « Reconnexion nécessaire » couvre le hors ligne — Réessayer
 * sonde le serveur, Se déconnecter purge la session. Il disparaît de lui-même
 * au retour en ligne ; les fichiers et la base ne bougent jamais.
 */
export function OfflineSessionGate() {
  const { t } = useTranslation(["downloads", "offline"]);
  const offline = useOfflineMode();
  const userId = useUserId();
  const [expired, setExpired] = useState(false);
  const { isChecking, retry, handleLogout } = useOfflineVeilActions();

  useEffect(() => {
    if (!offline || !userId) {
      setExpired(false);
      return;
    }
    const check = (): void => {
      const photo = cachedSession(userId);
      setExpired(photo === null || photo.expired);
    };
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, [offline, userId]);

  return (
    <OfflineBanner
      visible={offline && expired}
      title={t("downloads:sessionExpiredTitle")}
      message={t("offline:sessionExpiredMessage")}
      hint={null}
      isChecking={isChecking}
      onRetry={retry}
      onLogout={handleLogout}
    />
  );
}
