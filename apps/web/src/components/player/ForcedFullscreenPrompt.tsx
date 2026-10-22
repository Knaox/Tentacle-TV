import { memo } from "react";
import { useTranslation } from "react-i18next";
import { NoticeCard } from "../notices/NoticeCard";
import type { ForcedFullscreen } from "../../hooks/useForcedFullscreen";

/**
 * Le choix offert par le bouton plein écran quand le plein écran est imposé
 * (`useForcedFullscreen`). Monté seulement ouvert (règle GPU) ; les clics n'y
 * remontent pas jusqu'au capteur de la vidéo (pause, double-clic).
 */
export const ForcedFullscreenPrompt = memo(function ForcedFullscreenPrompt({ forced }: { forced: ForcedFullscreen }) {
  const { t } = useTranslation("player");
  if (!forced.promptOpen) return null;
  return (
    <div
      className="absolute inset-x-0 top-20 z-40 flex justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="w-[min(28rem,100%)]">
        <NoticeCard
          surface="player" severity="info" icon="alert"
          title={t("player:forcedFullscreenTitle")}
          lines={[t("player:forcedFullscreenBody")]}
          primary={{ label: t("player:forcedFullscreenSwitch"), onClick: forced.switchToX11 }}
          secondary={{ label: t("player:forcedFullscreenStay"), onClick: forced.closePrompt }}
          countdown={null} durationMs={null} onClose={forced.closePrompt}
        />
      </div>
    </div>
  );
});
