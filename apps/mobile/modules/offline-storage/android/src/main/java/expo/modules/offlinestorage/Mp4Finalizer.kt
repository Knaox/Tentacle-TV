package expo.modules.offlinestorage

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

/**
 * Remux SANS ré-encodage d'un MP4 fragmenté en MP4 classique.
 *
 * Le mode Allégé est le transcodage progressif de Jellyfin (`frag_keyframe +
 * empty_moov`) : un fichier valide, mais sans index ni durée. mpv s'en
 * accommode ; ExoPlayer y voit une durée inconnue et un flux qu'on ne peut
 * pas parcourir — plus de progression, pas de reprise, sous-titres calés sur
 * une horloge figée. On récrit les échantillons tels quels dans un MP4 doté de
 * sa table (`MediaExtractor` → `MediaMuxer`), dans `<fichier>.finalizing`, puis
 * on remplace l'original — jamais jeté avant que le nouveau soit écrit.
 */
object Mp4Finalizer {
  private const val BUFFER_BYTES = 8 shl 20

  fun finalize(path: String): Boolean {
    val source = File(path)
    if (!source.isFile) return false
    val target = File("$path.finalizing")
    if (target.exists() && !target.delete()) return false
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    var started = false
    try {
      extractor.setDataSource(source.absolutePath)
      val out = MediaMuxer(target.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = out
      val trackMap = IntArray(extractor.trackCount) { -1 }
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        // Vidéo et audio seulement : les sous-titres vivent en side-cars.
        if (!mime.startsWith("video/") && !mime.startsWith("audio/")) continue
        trackMap[index] = out.addTrack(format)
        extractor.selectTrack(index)
      }
      if (trackMap.none { it >= 0 }) return false
      out.start()
      started = true
      val buffer = ByteBuffer.allocateDirect(BUFFER_BYTES)
      val info = MediaCodec.BufferInfo()
      while (true) {
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        val track = trackMap[extractor.sampleTrackIndex]
        if (track >= 0) {
          info.set(0, size, extractor.sampleTime, sampleFlags(extractor.sampleFlags))
          out.writeSampleData(track, buffer, info)
        }
        extractor.advance()
      }
      out.stop()
      started = false
      out.release()
      muxer = null
      extractor.release()
      return replace(source, target)
    } catch (_: Exception) {
      return false
    } finally {
      try { if (started) muxer?.stop() } catch (_: Exception) { }
      try { muxer?.release() } catch (_: Exception) { }
      try { extractor.release() } catch (_: Exception) { }
      if (target.exists()) target.delete()
    }
  }

  private fun sampleFlags(flags: Int): Int =
    if (flags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0

  /** Le nouveau prend la place de l'ancien ; en cas d'échec, l'ancien revient. */
  private fun replace(source: File, target: File): Boolean {
    val backup = File("${source.path}.orig")
    if (backup.exists() && !backup.delete()) return false
    if (!source.renameTo(backup)) return false
    if (!target.renameTo(source)) {
      backup.renameTo(source)
      return false
    }
    backup.delete()
    return true
  }
}
