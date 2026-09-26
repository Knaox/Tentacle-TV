import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Captions, List, Settings } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useViewport } from "../../useFormFactor";
import { useIsTablet } from "../../useMirrorLayout";
import { PLAYER } from "../playerColors";
import { centerGap, playButtonSize, playerUiScale } from "../playerMetrics";
import { AirPlayButton } from "./AirPlayButton";
import { CenterControls } from "./CenterControls";
import { SeekBar } from "./SeekBar";
import { SkipIndicator } from "./SkipIndicator";
import { TouchButton } from "./TouchButton";

interface Props {
  opacity: number;
  title: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  item?: MediaItem;
  mediaSourceId?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  hasSubtitles: boolean;
  skipSide: "left" | "right" | null;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onBackgroundTap: () => void;
  onBack: () => void;
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSeek: (seconds: number) => void;
  onScrubStateChange: (active: boolean) => void;
  onOpenEpisodes: () => void;
  onOpenSubtitles: () => void;
  onOpenSettings: () => void;
}

/**
 * L'habillage visible du lecteur — le bloc `visible` de `MobilePlayerOverlay` :
 * voile 0,45 plein cadre (un tap dessus le retire), barre du haut (flèche
 * 26 × `ui`, titre 16 × `ui`), rangée centrale, et en bas la barre de lecture
 * suivie des boutons carrés (épisodes, sous-titres, réglages ; AirPlay sous
 * Safari) : fond `borderSubtle`, rayon 8, marge 12 sur tablette (8 au
 * téléphone ; toujours 8 pour Réglages, comme l'app), icônes 18 × `ui`.
 */
export function PlayerChrome(p: Props) {
  const { t } = useTranslation("player");
  const { width, height } = useViewport();
  const isTablet = useIsTablet();
  const ui = playerUiScale(isTablet);
  const squarePad = isTablet ? 12 : 8;
  const square = (pad: number) => ({ padding: pad, backgroundColor: PLAYER.borderSubtle, borderRadius: 8 });

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col transition-opacity ease-out motion-reduce:transition-none"
      style={{ opacity: p.opacity, backgroundColor: PLAYER.scrim, transitionDuration: "300ms" }}
    >
      <div className="pointer-events-auto absolute inset-0" onClick={(e) => { e.stopPropagation(); p.onBackgroundTap(); }} />

      <div
        className="relative flex flex-row items-center"
        style={{
          gap: 12,
          paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
          paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
        }}
      >
        <TouchButton onPress={p.onBack} label={t("back")} style={{ padding: 4 }}>
          <ArrowLeft size={Math.round(26 * ui)} color={PLAYER.text} />
        </TouchButton>
        <span className="min-w-0 flex-1 truncate" style={{ color: PLAYER.text, fontSize: Math.round(16 * ui), fontWeight: 600 }}>
          {p.title}
        </span>
      </div>

      <CenterControls
        paused={p.paused}
        ui={ui}
        centerGap={centerGap(isTablet, width)}
        playSize={playButtonSize(isTablet, height)}
        hasPrevious={p.hasPrevious}
        hasNext={p.hasNext}
        onPrevious={p.onPrevious}
        onNext={p.onNext}
        onPlayPause={p.onPlayPause}
        onRewind={p.onRewind}
        onForward={p.onForward}
      />

      <SkipIndicator side={p.skipSide} />

      <div
        className="relative flex flex-row items-end"
        style={{ paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "max(8px, env(safe-area-inset-right, 0px))" }}
      >
        <div className="min-w-0 flex-1">
          <SeekBar
            currentTime={p.currentTime}
            duration={p.duration}
            buffered={p.buffered}
            onSeek={p.onSeek}
            onScrubStateChange={p.onScrubStateChange}
            item={p.item}
            mediaSourceId={p.mediaSourceId}
          />
        </div>
        <div
          className="flex flex-row"
          style={{ gap: isTablet ? 10 : 6, marginBottom: "max(34px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}
        >
          <AirPlayButton videoRef={p.videoRef} />
          {p.item?.SeriesId && (
            <TouchButton onPress={p.onOpenEpisodes} label={t("episodes")} slop={12} style={square(squarePad)}>
              <List size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
            </TouchButton>
          )}
          {p.hasSubtitles && (
            <TouchButton onPress={p.onOpenSubtitles} label={t("subtitles")} slop={12} style={square(squarePad)}>
              <Captions size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
            </TouchButton>
          )}
          <TouchButton onPress={p.onOpenSettings} label={t("settings")} slop={12} style={square(8)}>
            <Settings size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
