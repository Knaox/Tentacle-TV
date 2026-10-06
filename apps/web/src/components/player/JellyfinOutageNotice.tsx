import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useOutageNotice, type OutageNotice } from "@tentacle-tv/api-client";
import { NoticeCard } from "../notices/NoticeCard";
import { useMessageCountdown } from "../session/useMessageCountdown";
import { useFullscreenPortalTarget } from "../../hooks/useFullscreenPortalTarget";

/**
 * Jellyfin redémarre, s'arrête, démarre — dit par le serveur Tentacle
 * (`server:jellyfin`), sur le lecteur web, le bureau et webOS. Un message
 * TEMPORAIRE, compte à rebours visible (`useOutageNotice`) : il paraît à
 * chaque nouvel état, puis s'efface — la lecture continue sur sa réserve, et
 * le retour de Jellyfin se passe sans un mot. Quand la panne dure, « ne
 * répond toujours pas » propose « Réessayer », la position gardée. Le survol
 * et le focus suspendent le compte. Monté dans la cible plein écran (sinon
 * invisible en plein écran) ; aucun flou : sur le bureau, mpv dessine sous la
 * page. Rien n'est monté hors panne.
 */
export const JellyfinOutageNotice = memo(function JellyfinOutageNotice({ onRetry }: { onRetry: () => void }) {
  const notice = useOutageNotice();
  const target = useFullscreenPortalTarget();
  if (!notice) return null;
  return createPortal(<OutageCard key={notice.occasion} notice={notice} onRetry={onRetry} />, target);
});

const OutageCard = memo(function OutageCard({ notice, onRetry }: { notice: OutageNotice; onRetry: () => void }) {
  const { t } = useTranslation("player");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const countdown = useMessageCountdown(notice.durationMs, hovered || focused, notice.done);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-auto w-[min(26rem,100%)]"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <NoticeCard
          surface="player"
          severity={notice.long ? "blocking" : "info"}
          icon="server"
          title={t(notice.copy.titleKey)}
          lines={[t(notice.copy.hintKey)]}
          primary={notice.long ? {
            label: t("jellyfinOutage.retry"),
            onClick: () => { notice.done(); onRetry(); },
          } : undefined}
          onClose={notice.done}
          countdown={countdown}
          durationMs={notice.durationMs}
        />
      </div>
    </div>
  );
});
