package com.tentacletv.boot

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Process
import android.util.Log

/**
 * Le « ta-dum » posé À L'IMAGE PRÈS sur la sortie, quelle que soit la latence
 * de l'appareil : une piste en FLUX ouverte dès la préparation joue du silence ;
 * l'heure demandée devient un numéro d'image de la sortie (d'après
 * `getTimestamp` : telle image sort à telle heure), et le fichier est écrit
 * dans le flux à ce numéro-là. Le retard d'un `play()` à froid et la latence
 * de sortie (HDMI compris) n'y changent rien — mesuré à l'émulateur : une
 * piste statique lancée à l'heure sortait de 130 à 200 ms trop tard, alors
 * que `getLatency()` en annonçait 10. Un départ demandé trop tard saute le
 * début du fichier (la vague, partie du silence) au lieu de décaler le « ta ».
 */
class BootSoundStream(private val sound: BootSoundPcm) {
  private val frameBytes = 2 * sound.channels
  private val chunkFrames = sound.sampleRate / 200 // 5 ms
  private val silence = ByteArray(chunkFrames * frameBytes)
  private val track: AudioTrack = AudioTrack.Builder()
    .setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
    )
    .setAudioFormat(
      AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(sound.sampleRate)
        .setChannelMask(if (sound.channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO)
        .build(),
    )
    .setTransferMode(AudioTrack.MODE_STREAM)
    .setBufferSizeInBytes(bufferBytes(sound, frameBytes))
    .build()

  /** L'heure demandée (ms, horloge des images) ; NaN : rien de demandé. */
  @Volatile private var targetMs = Double.NaN
  @Volatile private var running = true
  @Volatile private var volume = 1f
  private var written = 0L
  private val writer = Thread(::loop, "tentacle-bootsound-writer")

  val ready: Boolean get() = track.state == AudioTrack.STATE_INITIALIZED

  fun start() {
    track.play()
    writer.start()
  }

  fun playAt(hostMs: Double) {
    targetMs = hostMs
  }

  fun setVolume(next: Float) {
    volume = next
    track.setVolume(next)
  }

  fun release() {
    running = false
    writer.join(200)
    try {
      track.stop()
    } catch (_: IllegalStateException) {}
    track.release()
  }

  private fun loop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    var startFrame = -1L
    var skipped = 0
    while (running) {
      if (startFrame < 0 && !targetMs.isNaN()) {
        startFrame = frameAt(targetMs) ?: written
        skipped = (written - startFrame).coerceIn(0, sound.frames.toLong()).toInt()
        Log.i(TAG, "départ à l'image ${startFrame} de la sortie (${written} écrites), début sauté ${skipped * 1000 / sound.sampleRate} ms")
      }
      if (startFrame < 0 || written < startFrame) {
        val frames = if (startFrame < 0) chunkFrames.toLong() else minOf(chunkFrames.toLong(), startFrame - written)
        if (!write(silence, 0, (frames * frameBytes).toInt())) return
        continue
      }
      // Le fichier, d'un trait (écriture bloquante : elle suit la sortie), puis la piste se vide.
      write(sound.pcm, skipped * frameBytes, sound.pcm.size - skipped * frameBytes)
      if (running) logOffset(startFrame)
      return
    }
  }

  private fun write(bytes: ByteArray, offset: Int, size: Int): Boolean {
    var done = 0
    while (done < size && running) {
      val n = track.write(bytes, offset + done, minOf(size - done, silence.size * 4), AudioTrack.WRITE_BLOCKING)
      if (n <= 0) return false
      done += n
      written += n / frameBytes
    }
    return running
  }

  /** Le numéro de l'image de sortie qui sortira à `hostMs` ; null tant que la sortie ne dit rien. */
  private fun frameAt(hostMs: Double): Long? {
    val stamp = AudioTimestamp()
    if (!track.getTimestamp(stamp) || stamp.framePosition <= 0) return null
    return stamp.framePosition + ((hostMs - stamp.nanoTime / 1e6) * sound.sampleRate / 1000.0).toLong()
  }

  /** Mesure (journal seulement) : l'heure réelle de sortie de l'image prévue, d'après la sortie. */
  private fun logOffset(startFrame: Long) {
    val stamp = AudioTimestamp()
    if (!track.getTimestamp(stamp)) return
    val startMs = stamp.nanoTime / 1e6 + (startFrame - stamp.framePosition) * 1000.0 / sound.sampleRate
    Log.i(TAG, "écart à l'image : ${"%.1f".format(startMs - targetMs)} ms (positif : son en retard)")
  }

  companion object {
    private const val TAG = "TentacleBootSound"

    /** Le plus petit tampon permis, au moins 20 ms : l'écriture suit la sortie de près. */
    private fun bufferBytes(sound: BootSoundPcm, frameBytes: Int): Int {
      val channelMask = if (sound.channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
      val min = AudioTrack.getMinBufferSize(sound.sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
      return maxOf(min, sound.sampleRate / 50 * frameBytes)
    }
  }
}
