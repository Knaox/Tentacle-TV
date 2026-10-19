package com.tentacletv.boot

import android.content.res.AssetFileDescriptor
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.ByteArrayOutputStream

/** Le son décodé, prêt pour un AudioTrack statique (PCM 16 bits entrelacé). */
class BootSoundPcm(val pcm: ByteArray, val sampleRate: Int, val channels: Int) {
  val frames: Int get() = pcm.size / (2 * channels)
}

/**
 * Décode le fichier dérivé (AAC dans un .m4a, `assets/sound/boot-tadum.m4a`)
 * en PCM, une fois, d'avance. Un MediaCodec brut ne retire PAS l'amorce de
 * l'encodeur (le lecteur du système le fait, pas lui) : on la retire ici,
 * d'après l'`iTunSMPB` du fichier que l'extracteur rend en « encoder-delay »
 * — sans elle, le « ta » tomberait 44 ms trop tard.
 */
object BootSoundDecoder {
  /** L'amorce d'`afconvert` (AAC-LC), si le fichier ne la dit pas. */
  private const val DEFAULT_ENCODER_DELAY = 2112
  private const val TIMEOUT_US = 10_000L

  class Decoded(val sound: BootSoundPcm, val encoderDelay: Int, val delayFromFile: Boolean)

  fun decode(fd: AssetFileDescriptor): Decoded? {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: return null
      extractor.selectTrack(track)
      val input = extractor.getTrackFormat(track)
      val delayFromFile = input.containsKey(KEY_ENCODER_DELAY)
      val delay = if (delayFromFile) input.getInteger(KEY_ENCODER_DELAY) else DEFAULT_ENCODER_DELAY
      val padding = if (input.containsKey(KEY_ENCODER_PADDING)) input.getInteger(KEY_ENCODER_PADDING) else 0
      codec = MediaCodec.createDecoderByType(input.getString(MediaFormat.KEY_MIME)!!)
      codec.configure(input, null, null, 0)
      codec.start()

      val out = ByteArrayOutputStream(1 shl 20)
      var sampleRate = input.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = input.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      while (true) {
        if (!inputDone) {
          val index = codec.dequeueInputBuffer(TIMEOUT_US)
          if (index >= 0) {
            val size = extractor.readSampleData(codec.getInputBuffer(index)!!, 0)
            if (size < 0) {
              codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(index, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val index = codec.dequeueOutputBuffer(info, TIMEOUT_US)
        if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          sampleRate = codec.outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          channels = codec.outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        } else if (index >= 0) {
          if (info.size > 0) {
            val buffer = codec.getOutputBuffer(index)!!
            val chunk = ByteArray(info.size)
            buffer.position(info.offset)
            buffer.get(chunk)
            out.write(chunk)
          }
          codec.releaseOutputBuffer(index, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
        }
      }
      val all = out.toByteArray()
      val frameBytes = 2 * channels
      val start = (delay * frameBytes).coerceIn(0, all.size)
      val end = (all.size - padding * frameBytes).coerceIn(start, all.size)
      return Decoded(BootSoundPcm(all.copyOfRange(start, end), sampleRate, channels), delay, delayFromFile)
    } catch (_: Exception) {
      return null
    } finally {
      try {
        codec?.stop()
      } catch (_: Exception) {}
      codec?.release()
      extractor.release()
    }
  }

  // Les clés de l'extracteur (publiques depuis l'API 30 ; la chaîne vaut avant).
  private const val KEY_ENCODER_DELAY = "encoder-delay"
  private const val KEY_ENCODER_PADDING = "encoder-padding"
}
