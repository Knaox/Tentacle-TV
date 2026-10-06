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
 * Les mêmes mots que le mobile.
 */

import { memo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConnectivityNotice, type ConnectivityNotice } from "@tentacle-tv/api-client";
import { CONNECTIVITY_OFFLINE_MODE_KEY } from "@tentacle-tv/shared";
import { NoticeCard } from "../components/notices/NoticeCard";
import { useMessageCountdown } from "../components/session/useMessageCountdown";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";

export function OfflineSwitchBanner() {
  const { state, reason } = useConnectivity();
  const notice = useConnectivityNotice(state === "offline-auto", reason);
  const { pathname } = useLocation();
  if (!isDesktopApp() || !notice || pathname.startsWith("/watch/")) return null;
  return <SwitchCard key={notice.occasion} notice={notice} />;
}

const SwitchCard = memo(function SwitchCard({ notice }: { notice: ConnectivityNotice }) {
  const { t } = useTranslation("errors");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const countdown = useMessageCountdown(notice.durationMs, hovered || focused, notice.done);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[300] flex justify-center px-4">
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
          lines={[t(notice.hintKey), t(CONNECTIVITY_OFFLINE_MODE_KEY)]}
          onClose={notice.done}
          countdown={countdown}
          durationMs={notice.durationMs}
        />
      </div>
    </div>
  );
});
