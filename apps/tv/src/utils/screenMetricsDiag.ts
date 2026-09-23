import { Dimensions, InteractionManager, PixelRatio, Platform } from "react-native";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";

/**
 * Relevé UNIQUE de l'espace de points, en dev : ce que l'app croit avoir comme
 * canevas, à recroiser avec la dalle (`adb shell wm size` sur Android ;
 * 1920×1080 pt toujours sur Apple TV). Deux relevés : au chargement du module,
 * puis une fois l'écran interactif — s'ils diffèrent, la fenêtre n'était pas
 * finale au premier rendu (et tout `Dimensions.get` lu à l'import est faux).
 *
 * Attendus : Android 1080p → fenêtre 1920×1080, ratio 1 ; Android 4K → fenêtre
 * 1920×1080, écran 3840×2160, ratio 2 (TvDensity) ; Android 720p → 1706×960,
 * ratio 0,75 (le plancher 120 dpi) ; tvOS → 1920×1080, ratio 1.
 */
const RAIL_COLLAPSED_PT = 90 + TV_OVERSCAN_PT.x;

export function logScreenMetrics(tag: string): void {
  if (!__DEV__) return;
  const win = Dimensions.get("window");
  const scr = Dimensions.get("screen");
  const ratio = PixelRatio.get();
  console.log(
    `[TVMETRICS ${tag}] ${Platform.OS} ${String(Platform.Version)} · fenêtre ${win.width}×${win.height} pt`
    + ` · écran ${scr.width}×${scr.height} · ratio ${ratio} · police ×${PixelRatio.getFontScale()}`
    + ` · overscan x ${(100 * TV_OVERSCAN_PT.x / win.width).toFixed(1)} % / y ${(100 * TV_OVERSCAN_PT.y / win.height).toFixed(1)} %`
    + ` · rail ${(100 * RAIL_COLLAPSED_PT / win.width).toFixed(1) } %`,
  );
}

if (__DEV__) {
  logScreenMetrics("import");
  InteractionManager.runAfterInteractions(() => logScreenMetrics("interactif"));
}
