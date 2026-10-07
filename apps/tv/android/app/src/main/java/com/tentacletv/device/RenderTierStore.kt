package com.tentacletv.device

import android.content.Context
import android.content.SharedPreferences

/**
 * Ce que l'appareil GARDE du niveau de rendu, hors du JS (lu avant la
 * première image) :
 * - le réglage de l'utilisateur (`auto` / `on` / `off`) ;
 * - le micro-test, avec la SIGNATURE (empreinte du système + résolution) et la
 *   version qui l'ont mesuré. Une signature changée (mise à jour système,
 *   autre sortie vidéo) le fait refaire ; l'ancien score vaut en attendant —
 *   un appareil Lite par son micro-test ne repasse pas en normal le temps
 *   d'une mesure ;
 * - la dernière décision (niveau, raison) : les journaux et le diagnostic ;
 * - l'écran à rouvrir après un changement de réglage (une fois).
 */
internal class RenderTierStore(context: Context) {
  private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  data class Bench(val score: Double, val version: Int, val durationMs: Long, val signature: String)

  val mode: String
    get() = prefs.getString(KEY_MODE, "auto") ?: "auto"

  val bench: Bench?
    get() {
      if (!prefs.contains(KEY_BENCH_SCORE)) return null
      return Bench(
        prefs.getFloat(KEY_BENCH_SCORE, 0f).toDouble(),
        prefs.getInt(KEY_BENCH_VERSION, 0),
        prefs.getLong(KEY_BENCH_MS, 0),
        prefs.getString(KEY_BENCH_SIGNATURE, "") ?: "",
      )
    }

  /** Un micro-test à (re)faire : jamais mesuré, autre version, ou autre signature. */
  fun benchNeeded(signature: String): Boolean {
    val current = bench ?: return true
    return current.version != MicroBench.VERSION || current.signature != signature
  }

  fun saveBench(result: MicroBench.Result, signature: String) {
    prefs.edit()
      .putFloat(KEY_BENCH_SCORE, result.score.toFloat())
      .putInt(KEY_BENCH_VERSION, MicroBench.VERSION)
      .putLong(KEY_BENCH_MS, result.durationMs)
      .putString(KEY_BENCH_SIGNATURE, signature)
      .apply()
  }

  /** Le niveau décidé au lancement précédent (le budget mémoire part de lui
   *  avant que le JS ne décide : `memory/LiteMemory`). */
  val lastTier: String?
    get() = prefs.getString(KEY_LAST_TIER, null)

  fun saveDecision(tier: String, reason: String) {
    prefs.edit().putString(KEY_LAST_TIER, tier).putString(KEY_LAST_REASON, reason).apply()
  }

  /** L'écran à rouvrir, lu UNE fois : un second lancement ne le rejoue pas. */
  fun takeReturnState(): String? {
    val state = prefs.getString(KEY_RETURN, null) ?: return null
    prefs.edit().remove(KEY_RETURN).commit()
    return state
  }

  fun saveModeForReload(mode: String, returnState: String?) {
    prefs.edit().putString(KEY_MODE, mode).apply {
      if (returnState != null) putString(KEY_RETURN, returnState) else remove(KEY_RETURN)
    }.commit()
  }

  private companion object {
    const val NAME = "tentacle_render_tier"
    const val KEY_MODE = "mode"
    const val KEY_BENCH_SCORE = "bench_score"
    const val KEY_BENCH_VERSION = "bench_version"
    const val KEY_BENCH_MS = "bench_ms"
    const val KEY_BENCH_SIGNATURE = "bench_signature"
    const val KEY_LAST_TIER = "last_tier"
    const val KEY_LAST_REASON = "last_reason"
    const val KEY_RETURN = "return_state"
  }
}
