import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { CryingTentacle } from "@/components/CryingTentacle";
import { useServerReachable } from "@/hooks/useServerReachable";
import { unpairTv } from "../../auth/unpairTv";

interface OfflineBannerProps {
  /** Si true, recharge la page quand le serveur revient (mode backendDown initial). */
  reloadOnReconnect?: boolean;
}

/**
 * Le voile hors ligne de la LG — celui du web (`components/OfflineBanner.tsx`),
 * dont il garde le rendu, à une différence près : on n'y « déconnecte » pas,
 * on y DÉJUMELLE.
 *
 * Le web effaçait le jeton et l'utilisateur, rien de plus : le serveur gardait
 * le jumelage valide à vie, et la page rechargée (mode `reloadOnReconnect`)
 * avait perdu l'ancien jeton avant que quiconque ait pu le révoquer. Ici, le
 * déjumelage commun (`unpairTv`, origine `offline`) pose d'abord son marqueur —
 * qui survit au rechargement —, purge tout le compte, et la révocation part
 * dès que le serveur revient.
 *
 * Double appui, comme partout sur la LG (`AccountScreenTv`) : le premier arme,
 * le second exécute, quitter le bouton désarme. « Changer de serveur » est un
 * bouton du bureau seulement : rien de tel ici.
 */
export function OfflineBanner({ reloadOnReconnect = false }: OfflineBannerProps) {
  const { t } = useTranslation("common");
  // Les mots du déjumelage sont ceux des réglages : une seule source de textes.
  const { t: tPairing } = useTranslation("pairing");
  const { isReachable, retry } = useServerReachable();
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [armed, setArmed] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isReachable) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && reloadOnReconnect) {
      window.location.reload();
    }
  }, [isReachable, reloadOnReconnect]);

  if (isReachable) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await Promise.all([retry(), new Promise((r) => setTimeout(r, 600))]);
    } finally {
      setRetrying(false);
    }
  };

  const handleUnpair = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    unpairTv({ client, queryClient }, "offline");
    // Monté à la racine (mode backendDown), le voile court-circuite le routeur :
    // seul un rechargement fait paraître l'écran de jumelage. Sinon, la garde
    // de routes y mène d'elle-même.
    if (reloadOnReconnect) window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-surface-modal backdrop-blur-md"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="flex flex-col items-center px-8 text-center">
        <CryingTentacle size={160} />
        <h2 className="mt-8 text-2xl font-bold text-content-primary">{t("offlineTitle")}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-content-tertiary">{t("offlineMessage")}</p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-content-quaternary">{t("offlineHint")}</p>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retrying}
          className="mt-8 inline-flex min-w-[220px] items-center justify-center rounded-full bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg disabled:opacity-60"
        >
          {retrying ? t("retrying") : t("retryConnection")}
        </button>
        <button
          type="button"
          onClick={handleUnpair}
          onBlur={() => setArmed(false)}
          className="mt-3 inline-flex min-w-[220px] items-center justify-center rounded-full border border-danger-border bg-danger-surface px-7 py-3 text-sm font-semibold text-status-error-fg"
        >
          {armed ? tPairing("tvUnpairConfirm") : tPairing("tvUnpairDevice")}
        </button>
        {armed && <p className="mt-3 max-w-md text-xs text-content-tertiary">{tPairing("tvUnpairHint")}</p>}
      </div>
    </div>
  );
}
