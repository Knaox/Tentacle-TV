/**
 * Le passage hors ligne du BUREAU, dit — jamais un voile : l'application est
 * déjà sur son catalogue local (la pastille de la barre du haut reste là).
 *
 * Un message TEMPORAIRE, compte à rebours visible (`useConnectivityNotice`,
 * règle partagée `connectivityCase.ts`), qui dit l'un des trois cas — pas de
 * réseau, serveur Tentacle hors ligne, Jellyfin injoignable — puis s'efface ;
 * il reparaît à la bascule suivante, ou si la cause change. Le survol et le
 * focus suspendent le compte. Jamais en mode manuel, que l'utilisateur a
 * demandé lui-même ; jamais sur le lecteur, qui a ses propres messages.
 * Les mêmes mots que le mobile. Une session de profil vient de revenir au
 * compte de l'appareil faute de connexion (`accountFallback.ts`) : une ligne de
 * plus le dit, jusqu'à ce que le message s'efface ou que le réseau revienne.
 */

import { memo, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConnectivityNotice, type ConnectivityNotice } from "@tentacle-tv/api-client";
import { CONNECTIVITY_OFFLINE_MODE_KEY } from "@tentacle-tv/shared";
import { NoticeCard } from "../components/notices/NoticeCard";
import { useMessageCountdown } from "../components/session/useMessageCountdown";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";
import { useActiveProfile } from "../auth/profileSession";
import { clearAccountFallbackNotice, readAccountFallbackNotice } from "./accountFallback";

export function OfflineSwitchBanner() {
  const { state, reason } = useConnectivity();
  const notice = useConnectivityNotice(state === "offline-auto", reason);
  const { pathname } = useLocation();
  // La session d'un PROFIL n'a rien sur l'appareil : la cause, sans la ligne
  // « ce qui est sur cet appareil reste lisible ».
  const profileSession = useActiveProfile() !== null;
  const [fallbackName, setFallbackName] = useState(readAccountFallbackNotice);
  const forgetFallback = useCallback(() => {
    clearAccountFallbackNotice();
    setFallbackName(null);
  }, []);
  useEffect(() => {
    if (state === "online") forgetFallback();
  }, [state, forgetFallback]);
  if (!isDesktopApp() || !notice || pathname.startsWith("/watch/")) return null;
  return <SwitchCard key={notice.occasion} notice={notice} deviceContent={!profileSession} fallbackName={fallbackName} onFallbackSaid={forgetFallback} />;
}

interface SwitchCardProps {
  notice: ConnectivityNotice;
  deviceContent: boolean;
  /** Le compte revenu faute de connexion (`""` : sans nom), ou null. */
  fallbackName: string | null;
  onFallbackSaid: () => void;
}

const SwitchCard = memo(function SwitchCard({ notice, deviceContent, fallbackName, onFallbackSaid }: SwitchCardProps) {
  const { t } = useTranslation(["errors", "offline"]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { done } = notice;
  const onDone = useCallback(() => {
    onFallbackSaid();
    done();
  }, [done, onFallbackSaid]);
  const countdown = useMessageCountdown(notice.durationMs, hovered || focused, onDone);
  const fallbackLine = fallbackName === null ? [] : [fallbackName ? t("offline:accountFallback", { name: fallbackName }) : t("offline:accountFallbackUnnamed")];
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[300] flex justify-center px-4">
      <div
        className="pointer-events-auto w-[min(28rem,100%)] animate-fade-slide-down"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <NoticeCard
          severity="info"
          icon={notice.kind === "device" ? "wifiOff" : "server"}
          title={t(notice.titleKey)}
          lines={deviceContent ? [t(notice.hintKey), ...fallbackLine, t(CONNECTIVITY_OFFLINE_MODE_KEY)] : [t(notice.hintKey)]}
          onClose={onDone}
          countdown={countdown}
          durationMs={notice.durationMs}
        />
      </div>
    </div>
  );
});
