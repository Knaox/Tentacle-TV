import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import { CenterControls } from "@/components/player/CenterControls";
import { PlayerBottomBar } from "@/components/player/PlayerBottomBar";
import { PlayerTopBar } from "@/components/player/PlayerTopBar";

/**
 * L'habillage du lecteur pour le banc, figé en pause : les VRAIES pièces de
 * `MobilePlayerOverlay` (barre du haut, commandes du centre, barre du bas),
 * dans le même ordre et aux mêmes tailles. Quand la liste des épisodes est
 * ouverte, il en reste ce que la mise en page garde :
 * - `full` : tout (liste fermée) ;
 * - `top` : la barre du haut seule, sur un dégradé — l'image reste nue ;
 * - `none` : rien, la liste prend la main.
 */
export type BenchChrome = "full" | "top" | "none";

interface Props {
  mode: BenchChrome;
  title: string;
  currentTime: number;
  duration: number;
  onEpisodes: () => void;
}

const noop = () => undefined;

export function BenchPlayerChrome({ mode, title, currentTime, duration, onEpisodes }: Props) {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const ui = isTablet ? 1.4 : 1;
  if (mode === "none") return null;
  if (mode === "top") {
    return (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]} style={st.topShade} />
        <PlayerTopBar title={title} ui={ui} onBack={noop} />
      </View>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: PLAYER.scrim }]} pointerEvents="box-none">
      <PlayerTopBar title={title} ui={ui} onBack={noop} />
      <CenterControls
        paused
        ui={ui}
        centerGap={Math.min(isTablet ? 76 : 36, Math.round(width * 0.05))}
        playSize={Math.min(isTablet ? 92 : 60, Math.round(height * 0.08))}
        hasPrevious
        hasNext
        onPrevious={noop}
        onNext={noop}
        onPlayPause={noop}
        onRewind={noop}
        onForward={noop}
      />
      <PlayerBottomBar
        ui={ui}
        currentTime={currentTime}
        duration={duration}
        localSession
        onSeek={noop}
        onScrubStateChange={noop}
        onEpisodes={onEpisodes}
        onTracks={noop}
        onSettings={noop}
      />
    </View>
  );
}

const st = StyleSheet.create({
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
});
