import { type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { WtPlayerChrome } from "./useWtPlayerChrome";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import {
  groupPanelLayout, OVERLAY_PANEL_WIDTH, SIDE_PANEL_WIDTH, videoHeightAbove,
} from "@tentacle-tv/shared";

/**
 * Le cadre du lecteur en séance : la vidéo (`children`) et, ouvert, le
 * panneau du groupe à la place que lui donne `groupPanelLayout` — colonne à
 * droite (iPad paysage), dessous (iPad portrait), par-dessus à droite
 * (téléphone paysage), feuille du bas (téléphone portrait). Hors séance ou
 * panneau fermé, la vidéo seule, exactement comme avant : l'arbre de la
 * vidéo ne change jamais de parent (aucun rechargement à l'ouverture).
 */
export function WtPlayerFrame({ chrome, children }: {
  chrome: Pick<WtPlayerChrome, "open" | "close" | "panel">;
  children: ReactNode;
}) {
  const { open, close: onClose, panel } = chrome;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = groupPanelLayout(width, height, TABLET_MIN_WIDTH);
  const side = open && layout === "side";
  const below = open && layout === "below";

  return (
    <View style={[st.root, below && st.column]}>
      <View style={below ? { height: videoHeightAbove(width, height) + insets.top } : st.video}>{children}</View>
      {side && (
        <View style={[st.side, { width: SIDE_PANEL_WIDTH + insets.right, paddingRight: insets.right, paddingTop: insets.top }]}>
          {panel}
        </View>
      )}
      {below && <View style={[st.below, { paddingBottom: insets.bottom }]}>{panel}</View>}
      {open && layout === "overlay" && (
        <View style={[st.overlay, { width: OVERLAY_PANEL_WIDTH + insets.right, paddingRight: insets.right }]}>
          {panel}
        </View>
      )}
      {layout === "sheet" && (
        <BottomSheet visible={open} onClose={onClose} snapPoints={[0.55, 0.9]}>
          <View style={st.sheet}>{panel}</View>
        </BottomSheet>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: PLAYER.bg },
  column: { flexDirection: "column" },
  video: { flex: 1 },
  side: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: PLAYER.borderSubtle },
  below: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PLAYER.borderSubtle },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0 },
  sheet: { flex: 1, borderRadius: 16, overflow: "hidden" },
});
