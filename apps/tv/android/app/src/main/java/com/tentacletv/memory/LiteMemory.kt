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
    if (!releasing) return
    release("onTrimMemory $level")
    collect()
  }

  private const val COLLECT_EVERY_MS = 5_000L
  @Volatile private var lastCollect = 0L

  /**
   * Un ramassage Java, au plus toutes les 5 s, sous la pression du système :
   * ce que le natif retient pour des objets Java déjà morts (nœuds de rendu
   * des vues démontées, nœuds de mise en page, tampons) n'est rendu qu'après
   * leur ramassage — et le petit tas Java d'une app Lite n'en déclenche pas de
   * lui-même. Mesuré à l'émulateur (AVD 2 Go, Lite, `memoire run --trim`) :
   * voir `docs/android-tv-lite/MEMOIRE.md`.
   */
  private fun collect() {
    val now = android.os.SystemClock.uptimeMillis()
    if (now - lastCollect < COLLECT_EVERY_MS) return
    lastCollect = now
    Runtime.getRuntime().gc()
  }

  /** Vide les caches mémoire de Fresco (ce qui est affiché reste) ; Lite seulement. */
  fun release(why: String) {
    if (!lite) return
    try {
      val before = describeCache()
      ImagePipelineFactory.getInstance().imagePipeline.clearMemoryCaches()
      Log.i(TAG, "mémoire : caches d'images vidés ($why) — avant $before, après ${describeCache()}")
    } catch (error: Throwable) {
      // Fresco pas encore initialisé : rien à vider.
    }
  }

  /** L'état du cache des images décodées, pour le journal (`adb logcat -s TentacleLite`). */
  private fun describeCache(): String {
    val cache = ImagePipelineFactory.getInstance().bitmapCountingMemoryCache
    val mb = { bytes: Int -> "%.1f".format(bytes / 1048576f) }
    return "${cache.count} images, ${mb(cache.sizeInBytes)} Mo dont ${mb(cache.inUseSizeInBytes)} en usage " +
      "(plafond ${mb(cache.memoryCacheParams.maxCacheSize)})"
  }
}
