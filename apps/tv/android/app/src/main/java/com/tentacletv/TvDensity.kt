package com.tentacletv

import android.content.Context
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlin.math.roundToInt

/**
 * Densité NORMALISÉE pour TV : la fenêtre logique doit toujours faire
 * ~1920×1080 dp — l'espace de points d'Apple TV, référence de TOUTES les
 * tailles de l'app (cf. src/theme/responsive.ts). Sans ça, une TV Android
 * 1080p expose ~960×540 dp (densité 2) et l'UI paraît ~2× trop grande.
 * 1080p → 160 dpi (facteur 1), 4K → 320 ; clamp [120..640] contre les
 * panneaux exotiques. Appliquée sur le contexte APPLICATION (RN lit
 * Dimensions dessus — DisplayMetricsHolder) ET sur l'activité (layout natif).
 */
object TvDensity {
  fun densityDpi(context: Context): Int {
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
      ?: return DisplayMetrics.DENSITY_DEFAULT
    val dm = DisplayMetrics()
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(dm)
    val shortSide = minOf(dm.widthPixels, dm.heightPixels)
    if (shortSide <= 0) return DisplayMetrics.DENSITY_DEFAULT
    return (DisplayMetrics.DENSITY_DEFAULT * shortSide / 1080f).roundToInt()
      .coerceIn(120, 640)
  }
}
