import type { ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Captions, List, Settings, type LucideIcon } from "lucide-react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { PLAYER } from "@/theme";
import type { LocalTrickplay } from "../../hooks/offline/useLocalTrickplay";
import { useChromeInsets } from "../../player/chrome/useChromeInsets";
import { PlayerSeekBar } from "./PlayerSeekBar";

// AirPlay — iOS seulement (AVRoutePickerView natif).
const AirPlaySection: (props: { size?: number }) => ReactNode = Platform.OS === "ios"
  ? require("./AirPlayButton").AirPlaySection
  : () => null;

interface Props {
  ui: number;
  currentTime: number;
  duration: number;
  bufferedTime?: number;
  item?: MediaItem;
  mediaSourceId?: string;
  localTrickplay?: LocalTrickplay | null;
  localSession: boolean;
  onSeek: (seconds: number) => void;
  onScrubStateChange: (active: boolean) => void;
  /** Watch Together : le bouton du groupe, en tête des outils. */
  groupButton?: ReactNode;
  /** Les outils présents : `undefined` = pas de bouton. */
  onEpisodes?: () => void;
  onTracks?: () => void;
  onSettings?: () => void;
}

/**
 * Le bas des commandes : la barre de progression et les outils (groupe,
 * AirPlay, épisodes, audio et sous-titres, réglages). Collé au bas de
 * l'écran, au-dessus de l'indicateur d'accueil, à l'écart des seuls coins
 * arrondis (`chromeInsets`) — plus sous l'îlot, qui est au milieu d'un côté.
 */
export function PlayerBottomBar({
  ui, currentTime, duration, bufferedTime, item, mediaSourceId, localTrickplay, localSession,
  onSeek, onScrubStateChange, groupButton, onEpisodes, onTracks, onSettings,
}: Props) {
  const { t } = useTranslation("player");
  const edges = useChromeInsets();
  const iconSize = Math.round(20 * ui);
  return (
    <View
      pointerEvents="box-none"
      style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingLeft: edges.left, paddingRight: edges.right, paddingBottom: edges.bottom }}
    >
      <View style={{ flex: 1 }}>
        <PlayerSeekBar
          currentTime={currentTime}
          duration={duration}
          bufferedTime={bufferedTime}
          trickplayLocalOnly={localSession}
          onSeek={onSeek}
          onScrubStateChange={onScrubStateChange}
          item={item}
          mediaSourceId={mediaSourceId}
          localTrickplay={localTrickplay}
          sideGap={4}
          bottomGap={0}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: ui > 1 ? 10 : 4, marginBottom: 6 }}>
        {groupButton}
        <AirPlaySection size={iconSize} />
        {onEpisodes && <ToolButton icon={List} size={iconSize} label={t("panels.episodesTitle")} onPress={onEpisodes} />}
        {onTracks && <ToolButton icon={Captions} size={iconSize} label={t("panels.tracksTitle")} onPress={onTracks} />}
        {onSettings && <ToolButton icon={Settings} size={iconSize} label={t("panels.settingsTitle")} onPress={onSettings} />}
      </View>
    </View>
  );
}

/** Un outil du lecteur : le pictogramme seul, blanc, cible tactile de 44 pt. */
function ToolButton({ icon: Icon, size, label, onPress }: { icon: LucideIcon; size: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon size={size} color={PLAYER.text} />
    </Pressable>
  );
}
