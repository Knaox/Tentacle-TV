package com.tentacletv.boot

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
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
 *   `build.gradle`) : on ne fait ici que le lire.
 * - Décodé d'avance en PCM (`prepare`), joué par un AudioTrack STATIQUE : aucun
 *   décodage au moment du « ta ». L'heure demandée est celle des images (ms,
 *   horloge de Choreographer — `System.nanoTime`, celle que lit l'horloge
 *   Reanimated de l'ouverture) ; on retire la latence de sortie, et un départ en
 *   retard saute le début du fichier (la vague, partie du silence) au lieu de
 *   décaler le « ta ».
 * - Aucune demande de focus audio : une musique déjà en cours n'est pas coupée,
 *   le son s'y MÉLANGE (la catégorie « ambient » de tvOS).
 * - `claimIntro` : la MÉMOIRE DU PROCESSUS de l'ouverture (tv-core
 *   `bootIntroOnce`) — vrai au premier appel du processus seulement. Un drapeau
 *   natif : ni le rechargement du JavaScript ni la relance de l'interface du
 *   mode Lite ne l'effacent, seul un nouveau processus le remet.
 *
 * Journal : `adb logcat -s TentacleBootSound` (amorce retirée, latence, écart mesuré).
 */
class BootSoundModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val thread = HandlerThread("tentacle-bootsound", Process.THREAD_PRIORITY_URGENT_AUDIO).apply { start() }
  private val handler = Handler(thread.looper)
  private var track: AudioTrack? = null
  private var sound: BootSoundPcm? = null
  private var latencyMs = 0.0
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
      result.putDouble("now", nowMs())
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun playAt(hostMs: Double) {
    handler.post {
      val player = track ?: return@post
      val pcm = sound ?: return@post
      if (started) return@post
      started = true
      val delay = hostMs - nowMs() - latencyMs
      if (delay > 2.0) {
        handler.postAtTime({ start(player, pcm, hostMs, 0) }, SystemClock.uptimeMillis() + delay.toLong())
      } else {
        val skip = ((-delay / 1000.0) * pcm.sampleRate).toInt().coerceIn(0, pcm.frames - 1)
        start(player, pcm, hostMs, skip)
      }
    }
  }

  @ReactMethod
  fun fadeOut(ms: Double) {
    handler.post {
      val player = track ?: return@post
      val steps = (ms / FADE_STEP_MS).toInt().coerceAtLeast(1)
      for (step in 1..steps) {
        handler.postDelayed({
          if (track === player) player.setVolume(1f - step.toFloat() / steps)
        }, (step * FADE_STEP_MS).toLong())
      }
      handler.postDelayed({ if (track === player) stopQuietly(player) }, ms.toLong() + 50)
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
    if (track != null) return true
    val decoded = reactApplicationContext.assets.openFd(ASSET).use { BootSoundDecoder.decode(it) } ?: return false
    val pcm = decoded.sound
    val channelMask = if (pcm.channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
    val player = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(pcm.sampleRate)
          .setChannelMask(channelMask)
          .build(),
      )
      .setTransferMode(AudioTrack.MODE_STATIC)
      .setBufferSizeInBytes(pcm.pcm.size)
      .build()
    if (player.write(pcm.pcm, 0, pcm.pcm.size) != pcm.pcm.size || player.state != AudioTrack.STATE_INITIALIZED) {
      player.release()
      return false
    }
    latencyMs = outputLatencyMs(player, pcm)
    track = player
    sound = pcm
    started = false
    Log.i(TAG, "prêt : ${pcm.frames} images à ${pcm.sampleRate} Hz, amorce ${decoded.encoderDelay}" +
      "${if (decoded.delayFromFile) "" else " (supposée)"}, latence ${"%.1f".format(latencyMs)} ms")
    return true
  }

  private fun start(player: AudioTrack, pcm: BootSoundPcm, hostMs: Double, skipFrames: Int) {
    if (track !== player) return
    if (skipFrames > 0) player.setPlaybackHeadPosition(skipFrames)
    player.play()
    // Mesure (journal seulement) : l'heure réelle à laquelle la première image du fichier sort.
    handler.postDelayed({ logOffset(player, pcm, hostMs) }, 400)
  }

  private fun logOffset(player: AudioTrack, pcm: BootSoundPcm, hostMs: Double) {
    if (track !== player) return
    val stamp = AudioTimestamp()
    if (!player.getTimestamp(stamp)) return
    val firstFrameMs = stamp.nanoTime / 1e6 - stamp.framePosition * 1000.0 / pcm.sampleRate
    Log.i(TAG, "écart à l'image : ${"%.1f".format(firstFrameMs - hostMs)} ms (positif : son en retard)")
  }

  private fun release() {
    handler.removeCallbacksAndMessages(null)
    track?.let { stopQuietly(it); it.release() }
    track = null
    sound = null
    started = false
  }

  private fun stopQuietly(player: AudioTrack) {
    try {
      player.stop()
    } catch (_: IllegalStateException) {}
  }

  /**
   * La latence de sortie : `AudioTrack.getLatency()` (cachée, la même que lit
   * ExoPlayer) compte aussi le tampon de la piste — ici le fichier entier —,
   * qu'on retire. Rien de lisible : zéro (le « ta » part un peu tard).
   */
  private fun outputLatencyMs(player: AudioTrack, pcm: BootSoundPcm): Double = try {
    val total = (AudioTrack::class.java.getMethod("getLatency").invoke(player) as Int).toDouble()
    (total - pcm.frames * 1000.0 / pcm.sampleRate).coerceIn(0.0, MAX_LATENCY_MS)
  } catch (_: Exception) {
    0.0
  }

  private fun nowMs(): Double = System.nanoTime() / 1e6

  companion object {
    private const val TAG = "TentacleBootSound"
    private const val ASSET = "boot-tadum.m4a"
    private const val FADE_STEP_MS = 20.0
    private const val MAX_LATENCY_MS = 300.0

    @Volatile private var introClaimed = false
  }
}
