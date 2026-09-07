package expo.modules.offlinestorage

import java.io.File
import java.io.RandomAccessFile

/** Ce que l'index d'un fichier MP4 permet d'en faire. */
enum class Mp4Index {
  /** Aucun `moov` : le transfert s'est achevé avant que le serveur livre son
   *  index. Rien ne le répare sur l'appareil — il faut le retélécharger. */
  MISSING,

  /** `moov` avec `mvex` : les échantillons vivent dans les `moof`, à remuxer. */
  FRAGMENTED,

  /** `moov` complet : le fichier se lit tel quel. */
  INDEXED,
}

/**
 * Le strict nécessaire de l'arbre de boîtes : la présence du `moov`, et sa
 * nature. Quelques lectures d'en-têtes, jamais le fichier entier — un titre
 * pèse des centaines de mégaoctets.
 */
object Mp4Boxes {
  /** Un `moov` d'index reste petit ; au-delà, on ne cherche pas à comprendre. */
  private const val MAX_MOOV_BYTES = 64L shl 20

  fun index(path: String): Mp4Index {
    val file = File(path)
    if (!file.isFile) return Mp4Index.MISSING
    RandomAccessFile(file, "r").use { handle ->
      val size = handle.length()
      var offset = 0L
      while (offset + 8 <= size) {
        handle.seek(offset)
        var boxSize = handle.readInt().toLong() and 0xFFFFFFFFL
        val type = ByteArray(4).also { handle.readFully(it) }.toString(Charsets.ISO_8859_1)
        var headerSize = 8L
        if (boxSize == 1L) {
          boxSize = handle.readLong()
          headerSize = 16L
        } else if (boxSize == 0L) {
          boxSize = size - offset
        }
        if (boxSize < headerSize || offset + boxSize > size) return Mp4Index.MISSING
        if (type == "moov") {
          val length = boxSize - headerSize
          if (length <= 0 || length > MAX_MOOV_BYTES) return Mp4Index.MISSING
          return if (hasChild(handle, offset + headerSize, length, "mvex")) Mp4Index.FRAGMENTED else Mp4Index.INDEXED
        }
        offset += boxSize
      }
    }
    return Mp4Index.MISSING
  }

  /** Un enfant direct de ce conteneur porte-t-il ce nom ? */
  private fun hasChild(handle: RandomAccessFile, start: Long, length: Long, name: String): Boolean {
    var offset = start
    val end = start + length
    while (offset + 8 <= end) {
      handle.seek(offset)
      var boxSize = handle.readInt().toLong() and 0xFFFFFFFFL
      val type = ByteArray(4).also { handle.readFully(it) }.toString(Charsets.ISO_8859_1)
      var headerSize = 8L
      if (boxSize == 1L) {
        boxSize = handle.readLong()
        headerSize = 16L
      } else if (boxSize == 0L) {
        boxSize = end - offset
      }
      if (boxSize < headerSize || offset + boxSize > end) return false
      if (type == name) return true
      offset += boxSize
    }
    return false
  }
}
