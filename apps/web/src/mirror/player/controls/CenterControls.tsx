import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { PLAYER } from "../playerColors";
import { TouchButton } from "./TouchButton";

interface Props {
  paused: boolean;
  ui: number;
  centerGap: number;
  playSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
}

/**
 * La rangée centrale du lecteur — `CenterControls` de l'app. Cinq emplacements
 * TOUJOURS réservés : au premier/dernier épisode, un fantôme invisible de même
 * emprise garde lecture/pause au centre optique. Icônes 22 / 24 / 30 × `ui`,
 * libellés « 10 » / « 30 » à 10 × `ui`, bouton lecture rond `playSize` sur
 * `border` (blanc 20 %). Les zones vides laissent passer le tap au fond.
 */
export const CenterControls = memo(function CenterControls({
  paused, ui, centerGap, playSize, hasPrevious, hasNext,
  onPrevious, onNext, onPlayPause, onRewind, onForward,
}: Props) {
  const { t } = useTranslation("player");
  const epIcon = Math.round(22 * ui);
  const skipIcon = Math.round(24 * ui);
  const skipLabel = { color: PLAYER.text, fontSize: Math.round(10 * ui), fontWeight: 600, textAlign: "center", marginTop: 2, lineHeight: 1.2 } as const;

  return (
    <div
      className="pointer-events-none relative flex flex-1 flex-row items-center justify-center"
      style={{ gap: centerGap, paddingInline: "max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))" }}
    >
      {hasPrevious && onPrevious ? (
        <TouchButton onPress={onPrevious} label={t("previousEpisode")} style={{ padding: 8 }}>
          <SkipBack size={epIcon} color={PLAYER.textSecondary} />
        </TouchButton>
      ) : (
        <div aria-hidden style={{ padding: 8, opacity: 0 }}><SkipBack size={epIcon} /></div>
      )}

      <TouchButton onPress={onRewind} label={t("skipBack")} style={{ padding: 8 }}>
        <span className="flex flex-col items-center">
          <RotateCcw size={skipIcon} color={PLAYER.text} />
          <span style={skipLabel}>10</span>
        </span>
      </TouchButton>

      <TouchButton onPress={onPlayPause} label={paused ? t("play") : t("pause")}>
        <span
          className="flex items-center justify-center"
          style={{ width: playSize, height: playSize, borderRadius: playSize / 2, backgroundColor: PLAYER.border }}
        >
          {paused
            ? <Play size={Math.round(30 * ui)} color={PLAYER.text} />
            : <Pause size={Math.round(30 * ui)} color={PLAYER.text} />}
        </span>
      </TouchButton>

      <TouchButton onPress={onForward} label={t("skipForward")} style={{ padding: 8 }}>
        <span className="flex flex-col items-center">
          <RotateCw size={skipIcon} color={PLAYER.text} />
          <span style={skipLabel}>30</span>
        </span>
      </TouchButton>

      {hasNext && onNext ? (
        <TouchButton onPress={onNext} label={t("nextEpisode")} style={{ padding: 8 }}>
          <SkipForward size={epIcon} color={PLAYER.textSecondary} />
        </TouchButton>
      ) : (
        <div aria-hidden style={{ padding: 8, opacity: 0 }}><SkipForward size={epIcon} /></div>
      )}
    </div>
  );
});
