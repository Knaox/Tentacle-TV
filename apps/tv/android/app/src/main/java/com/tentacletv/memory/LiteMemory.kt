package com.tentacletv.memory

import android.app.ActivityManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.util.Log
import com.facebook.common.internal.Supplier
import com.facebook.imagepipeline.cache.DefaultBitmapMemoryCacheParamsSupplier
import com.facebook.imagepipeline.cache.MemoryCacheParams
import com.facebook.imagepipeline.core.ImagePipelineFactory
import com.swmansion.rnscreens.ScreenStack

/**
 * La MÉMOIRE du mode Lite (Android TV) : ce que le niveau `lite` change hors
 * du JS — le cache d'images de Fresco plafonné, le décodage économe
 * (`LiteJpegDecoder`), les écrans recouverts rendus à Android, et la purge sur
 * `onTrimMemory`. En mode normal, RIEN ne change : chaque réglage rend la
 * valeur d'origine.
 *
 * Le niveau se décide dans le JS (tv-core `device/renderTier`) et revient ici
 * par `TentacleDevice.report`, au chargement du bundle — avant la première
 * image. D'ici là, on part de la décision du lancement précédent
 * (`RenderTierStore.lastTier`) : le cache de Fresco, créé à la première image
 * demandée, lit déjà le bon budget, et le relit toutes les 30 s.
 *
 * Mesures et raisons : `docs/android-tv-lite/MEMOIRE.md`.
 */
object LiteMemory {
  const val TAG = "TentacleLite"

  /** Le cache des images DÉCODÉES en Lite : ce qui est affiché y est compté,
   *  ce qui ne l'est plus n'y reste que dans la file d'éviction. */
  private const val BITMAP_CACHE_BYTES = 24 * 1024 * 1024
  private const val BITMAP_CACHE_ENTRIES = 160
  private const val BITMAP_EVICTION_BYTES = 8 * 1024 * 1024
  private const val BITMAP_EVICTION_ENTRIES = 64
  private const val PARAMS_CHECK_MS = 30_000L

  @Volatile
  var lite: Boolean = false
    private set

  /** Le niveau connu : celui du lancement précédent au démarrage, puis celui du JS. */
  fun apply(tier: String?) {
    val next = tier == "lite"
    val changed = next != lite
    lite = next
    // Recouvert, un écran reste attaché (`CoveredScreens`, pas de rattache au
    // Retour) ; ses images y restaient « en usage », jamais évincées. En Lite,
    // caché, il passe INVISIBLE : ses vues restent (React, le focus, l'endroit
    // où revenir), ses images sont relâchées et se rechargent au retour.
    ScreenStack.releaseCoveredScreens = next
    if (changed) Log.i(TAG, "mémoire : ${if (next) "Lite (cache d'images ${BITMAP_CACHE_BYTES shr 20} Mo, images des écrans recouverts relâchées)" else "normale"}")
  }

  /** Le budget du cache d'images : Lite, plafonné ; sinon celui de Fresco. */
  fun bitmapCacheParams(context: Context): Supplier<MemoryCacheParams> {
    val defaults = DefaultBitmapMemoryCacheParamsSupplier(context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
    return Supplier {
      if (lite) {
        MemoryCacheParams(BITMAP_CACHE_BYTES, BITMAP_CACHE_ENTRIES, BITMAP_EVICTION_BYTES, BITMAP_EVICTION_ENTRIES, Int.MAX_VALUE, PARAMS_CHECK_MS)
      } else {
        defaults.get()
      }
    }
  }

  /**
   * `onTrimMemory` (Lite) : les images que plus rien n'affiche quittent la
   * mémoire dès que le système manque de place ou que l'app passe derrière.
   * Les écrans recouverts sont déjà rendus à Android (`apply`).
   */
  fun onTrimMemory(level: Int) {
    if (!lite) return
    val releasing = level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN ||
      level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
      level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL
    if (releasing) release("onTrimMemory $level")
  }

  /** Vide les caches mémoire de Fresco (ce qui est affiché reste) ; Lite seulement. */
  fun release(why: String) {
    if (!lite) return
    try {
      ImagePipelineFactory.getInstance().imagePipeline.clearMemoryCaches()
      Log.i(TAG, "mémoire : caches d'images vidés ($why)")
    } catch (error: Throwable) {
      // Fresco pas encore initialisé : rien à vider.
    }
  }
}
