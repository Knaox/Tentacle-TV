import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinOutage } from "@tentacle-tv/api-client";
import { jellyfinOutageCopy } from "@tentacle-tv/shared";
import { NoticeCard } from "../notices/NoticeCard";
import { useFullscreenPortalTarget } from "../../hooks/useFullscreenPortalTarget";

/** Après « Réessayer », l'écran d'arrêt redevient un bandeau le temps de voir si ça reprend. */
const RETRY_SNOOZE_MS = 30_000;

/**
 * Jellyfin redémarre, s'arrête, démarre — dit par le serveur Tentacle
 * (`server:jellyfin`), sur le lecteur web et le bureau. Un bandeau non
 * bloquant (la lecture directe continue sur sa réserve) ; quand la panne dure
 * (`long`), l'écran d'arrêt avec « Réessayer », la position gardée. Monté
 * dans la cible plein écran (sinon invisible en plein écran) ; aucun flou :
 * sur le bureau, mpv dessine sous la page. Rien n'est monté hors panne.
 */
export const JellyfinOutageNotice = memo(function JellyfinOutageNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("player");
  const outage = useJellyfinOutage();
  const target = useFullscreenPortalTarget();
  const [closedState, setClosedState] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  if (outage.phase !== "outage" && outage.phase !== "long") return null;
  const long = outage.phase === "long" && Date.now() > snoozedUntil;
  // Fermé à la main : il revient au prochain changement d'état, ou quand la panne dure.
  if (!long && closedState === outage.state) return null;
  const copy = jellyfinOutageCopy(outage.state, long);
  if (!copy) return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto w-[min(26rem,100%)]" data-jellyfin-outage={outage.state}>
        <NoticeCard
          surface="player"
          severity={long ? "blocking" : "info"}
          icon="server"
          title={t(copy.titleKey)}
          lines={[t(copy.hintKey)]}
          primary={long ? {
            label: t("jellyfinOutage.retry"),
            onClick: () => { setSnoozedUntil(Date.now() + RETRY_SNOOZE_MS); onRetry(); },
          } : undefined}
          onClose={() => setClosedState(outage.state)}
          countdown={null}
          durationMs={null}
        />
      </div>
    </div>,
    target,
  );
});
