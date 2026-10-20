package com.tentacletv.boot

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * `TentacleBootSound`, le jumeau Android de `ios/TentacleTV/TentacleBootSound.m` :
 * le « ta-dum » de l'ouverture du démarrage, joué À L'HEURE de l'image.
 *
 * - Le fichier est le MÊME que sur l'Apple TV (`apps/tv/assets/sound/boot-tadum.m4a`,
 *   dérivé de la synthèse partagée, posé tel quel dans les assets de l'APK par
 *   `build.gradle`) : on ne fait ici que le lire, décodé d'avance en PCM
 *   (`BootSoundDecoder`, amorce de l'encodeur retirée).
 * - L'heure demandée est celle des images (ms, horloge de Choreographer —
 *   `System.nanoTime`, celle que lit l'horloge Reanimated de l'ouverture) ;
 *   `BootSoundStream` la tient sur la SORTIE, à l'image près, latence comprise.
 * - Aucune demande de focus audio : une musique déjà en cours n'est pas coupée,
 *   le son s'y MÉLANGE (la catégorie « ambient » de tvOS).
 * - Le mode SILENCIEUX du téléphone le tait, comme le commutateur de l'iPhone
 *   tait la catégorie « ambient » : le mobile compile ce même code
 *   (apps/mobile/android/app/build.gradle). Le VIBREUR, non : sur Android, il
 *   ne tait que la sonnerie et les notifications, jamais le média (une vidéo,
 *   un jeu) — le son suit alors le volume média, à zéro il ne s'entend pas.
 *   Couper au vibreur taisait l'ouverture chez presque tous les téléphones,
 *   que l'on laisse en vibreur. Une TV est toujours en mode normal.
 * - `claimIntro` : la MÉMOIRE DU PROCESSUS de l'ouverture (tv-core
 *   `bootIntroOnce`) — vrai au premier appel du processus seulement. Un drapeau
 *   natif : ni le rechargement du JavaScript ni la relance de l'interface du
 *   mode Lite ne l'effacent, seul un nouveau processus le remet.
 *
 * Journal : `adb logcat -s TentacleBootSound` (amorce, départ, écart mesuré à la sortie,
 * « libéré sans départ » quand le son préparé n'a jamais été demandé).
 */
class BootSoundModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  // Une file à elle : ni le fil d'interface ni celui du JavaScript ne décodent le fichier.
  private val thread = HandlerThread("tentacle-bootsound").apply { start() }
  private val handler = Handler(thread.looper)
  private var stream: BootSoundStream? = null
  private var started = false

  override fun getName(): String = "TentacleBootSound"

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun claimIntro(): Boolean = synchronized(BootSoundModule::class.java) {
    val first = !introClaimed
    introClaimed = true
    first
  }

  @ReactMethod
  fun prepare(promise: Promise) {
    handler.post {
      val ready = try {
        load()
      } catch (error: Exception) {
        Log.w(TAG, "préparation impossible", error)
        false
      }
      val result = Arguments.createMap()
      result.putBoolean("ready", ready)
      result.putDouble("now", System.nanoTime() / 1e6)
      // Le temps que la sortie démarre et se date : la préparation part pendant que le poulpe s'assemble.
      val lead = if (ready) stream?.outputLeadMs(LEAD_WAIT_MS) else null
      if (lead != null) result.putDouble("outputLeadMs", lead)
      Log.i(TAG, "avance de la sortie : ${lead?.let { "%.0f ms".format(it) } ?: "inconnue"}")
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun playAt(hostMs: Double) {
    handler.post {
      val current = stream ?: return@post
      if (started) return@post
      started = true
      current.playAt(hostMs)
    }
  }

  @ReactMethod
  fun fadeOut(ms: Double) {
    handler.post {
      val current = stream ?: return@post
      val steps = (ms / FADE_STEP_MS).toInt().coerceAtLeast(1)
      for (step in 1..steps) {
        handler.postDelayed({ if (stream === current) current.setVolume(1f - step.toFloat() / steps) }, (step * FADE_STEP_MS).toLong())
      }
      handler.postDelayed({ if (stream === current) release() }, ms.toLong() + 50)
    }
  }

  @ReactMethod
  fun dispose() {
    handler.post { release() }
  }

  override fun invalidate() {
    handler.post {
      release()
      thread.quitSafely()
    }
    super.invalidate()
  }

  private fun load(): Boolean {
    if (stream != null) return true
    val audio = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    if (audio != null && audio.ringerMode == AudioManager.RINGER_MODE_SILENT) {
      Log.i(TAG, "mode silencieux : aucun son")
      return false
    }
    val decoded = reactApplicationContext.assets.openFd(ASSET).use { BootSoundDecoder.decode(it) } ?: return false
    val next = BootSoundStream(decoded.sound)
    if (!next.ready) {
      next.release()
      return false
    }
    // Ouverte dès maintenant : le silence fait démarrer la sortie bien avant le « ta ».
    next.start()
    stream = next
    started = false
    Log.i(TAG, "prêt : ${decoded.sound.frames} images à ${decoded.sound.sampleRate} Hz, " +
      "amorce ${decoded.encoderDelay}${if (decoded.delayFromFile) "" else " (supposée)"}")
    return true
  }

  private fun release() {
    handler.removeCallbacksAndMessages(null)
    // Le cas muet, lisible en Release : préparé, jamais demandé (le JS a renoncé au son).
    if (stream != null && !started) Log.i(TAG, "libéré sans départ : playAt jamais reçu")
    stream?.release()
    stream = null
    started = false
  }

  companion object {
    private const val TAG = "TentacleBootSound"
    private const val ASSET = "boot-tadum.m4a"
    private const val FADE_STEP_MS = 20.0
    private const val LEAD_WAIT_MS = 500L

    @Volatile private var introClaimed = false
  }
}
