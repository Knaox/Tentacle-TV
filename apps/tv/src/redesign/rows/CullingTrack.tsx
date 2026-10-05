import type { ReactNode } from "react";
import { UIManager, requireNativeComponent, type HostComponent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { ROW_RECEDE } from "@tentacle-tv/tv-core";
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
 *
 * `recede` : la piste joue aussi le RECUL des voisines de la carte focalisée
 * (`RowRecede.kt`, profil `nativeRecede`), avec les jetons du thème — les
 * cartes désignent leur cadre (`RowPlace.native`) et n'animent plus rien.
 */

const VIEW_NAME = "TentacleCullTrack";

interface NativeTrackProps extends ViewProps {
  recedeFrames?: boolean;
  recedeOpacity?: number;
  recedeMs?: number;
  recedeReleaseMs?: number;
  recedeCurve?: readonly number[];
}

const NativeTrack: HostComponent<NativeTrackProps> | null =
  RENDER.cullOffscreen && UIManager.getViewManagerConfig(VIEW_NAME) != null ? requireNativeComponent<NativeTrackProps>(VIEW_NAME) : null;

/** Vrai quand la piste élaguée existe sur cet appareil. */
export const CULLING_TRACK = NativeTrack !== null;

/** Vrai quand la piste joue le recul des voisines (`RowPlace.native`). */
export const NATIVE_RECEDE = CULLING_TRACK && RENDER.nativeRecede;

export function CullingTrack({
  gap,
  recede = false,
  style,
  children,
}: {
  gap: number;
  /** Elle joue le recul des voisines (seulement là où `NATIVE_RECEDE`). */
  recede?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (!NativeTrack) return <>{children}</>;
  return (
    <NativeTrack
      collapsable={false}
      style={[{ flexDirection: "row", gap }, style]}
      recedeFrames={recede && NATIVE_RECEDE}
      recedeOpacity={TV_STAGE.focus.recede}
      recedeMs={TV_MOTION.focus.recedeMs}
      recedeReleaseMs={ROW_RECEDE.releaseMs}
      recedeCurve={TV_MOTION.curve.inOut}
    >
      {children}
    </NativeTrack>
  );
}
