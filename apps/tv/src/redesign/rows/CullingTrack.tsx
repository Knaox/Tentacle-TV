import type { ReactNode } from "react";
import { UIManager, requireNativeComponent, type HostComponent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { RENDER } from "../render/renderProfile";

/**
 * La piste d'une rangée défilante, élaguée (`cullOffscreen` du profil de
 * rendu) : sur Android TV, la vue native `TentacleCullTrack` ne met dans sa
 * liste d'affichage que les cartes à l'écran (marge comprise) — toutes restent
 * montées et focalisables, seul le RenderThread ne parcourt plus les autres.
 * Ailleurs (Apple TV), rien : les cartes restent les enfants directs du
 * contenu de la ScrollView, comme avant.
 *
 * Elle s'insère entre le contenu de la ScrollView (qui garde son style : les
 * marges, l'espacement) et les cartes : une ligne, au même espacement — la
 * même mise en page.
 */

const VIEW_NAME = "TentacleCullTrack";

const NativeTrack: HostComponent<ViewProps> | null =
  RENDER.cullOffscreen && UIManager.getViewManagerConfig(VIEW_NAME) != null ? requireNativeComponent<ViewProps>(VIEW_NAME) : null;

/** Vrai quand la piste élaguée existe sur cet appareil. */
export const CULLING_TRACK = NativeTrack !== null;

export function CullingTrack({ gap, style, children }: { gap: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (!NativeTrack) return <>{children}</>;
  return (
    <NativeTrack collapsable={false} style={[{ flexDirection: "row", gap }, style]}>
      {children}
    </NativeTrack>
  );
}
