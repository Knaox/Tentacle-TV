package com.tentacletv.perf

/**
 * Le MODE DE MESURE d'Android TV, éteint par défaut. Il s'allume sans
 * reconstruire l'app, sur n'importe quelle build (celle du Play Store
 * comprise) :
 *
 *   adb shell setprop debug.tentacle.perf 1    puis relancer l'app
 *   adb logcat -s TentaclePerf                 le journal « [perf] »
 *   adb shell setprop debug.tentacle.perf 0    pour l'éteindre
 *
 * Éteint, il ne coûte rien : la propriété est lue une fois, aucun écouteur
 * n'est posé, aucun fil n'est créé, et le JS n'appelle jamais le module.
 * Procédure et seuils : `docs/tv-navigation/android-perf.md`.
 */
internal object PerfConfig {
  private const val PROPERTY = "debug.tentacle.perf"

  val enabled: Boolean by lazy { systemProperty(PROPERTY) == "1" }

  /** `android.os.SystemProperties` est caché du SDK : lu par réflexion, une fois. */
  private fun systemProperty(name: String): String? = try {
    Class.forName("android.os.SystemProperties").getMethod("get", String::class.java).invoke(null, name) as? String
  } catch (_: Throwable) {
    null
  }
}
