import type { ReactNode } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import { PlayerClock } from "../../player/chrome/PlayerClock";
import { statusBarPlan } from "../../player/chrome/statusBarPlan";
import { useChromeInsets } from "../../player/chrome/useChromeInsets";

interface Props {
  title: string;
  ui: number;
  onBack: () => void;
  /** Le haut droit : image dans l'image, diffusion. */
  actions?: ReactNode;
}

/**
 * La barre du haut du lecteur : Retour, titre, actions, et — là où iOS refuse
 * sa barre d'état (iPhone en paysage) — l'heure et la batterie. EN HAUT, à
 * l'écart des seuls coins arrondis et de l'encoche (`chromeInsets`) ; la barre
 * d'état qui paraît avec les commandes ne la fait pas sauter.
 */
export function PlayerTopBar({ title, ui, onBack, actions }: Props) {
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const inlineClock = statusBarPlan({
    os: Platform.OS, isTablet: Math.min(width, height) >= TABLET_MIN_WIDTH,
    landscape: width > height, controlsVisible: true, pipActive: false,
  }).inlineClock;
  return (
    <View
      pointerEvents="box-none"
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingTop: edges.top, paddingLeft: edges.left, paddingRight: edges.right,
      }}
    >
      <Pressable onPress={onBack} hitSlop={16} style={{ padding: 4 }}>
        <ArrowLeft size={Math.round(26 * ui)} color={PLAYER.text} />
      </Pressable>
      <Text numberOfLines={1} style={{ color: PLAYER.text, fontSize: Math.round(16 * ui), fontWeight: "600", flex: 1 }}>{title}</Text>
      {actions}
      {inlineClock && <PlayerClock ui={ui} />}
    </View>
  );
}
