package com.tentacle.mobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns

/**
 * Le PARTAGE SYSTÈME vers Tentacle TV : l'intent devient un `VIEW` vers le lien profond de l'import — la seule
 * forme que React Native lit (lien initial, puis évènement `url`). Source : `apps/mobile/targets/ShareIntakeAndroid/`,
 * recopiée par le config plugin `withShareToTentacle` — jamais retouchée dans `android/`.
 * - `SEND` de TEXTE : le texte reçu, TEL QUEL, dans `tentacle://octave/import?shared=<texte>` ; le JavaScript y
 *   trouve le lien de playlist ou de page Bandcamp (`sharedImportLink`, `recognizeReleaseUrl`, shared).
 * - `SEND` / `SEND_MULTIPLE` d'AUDIO ou d'un ZIP (lot « sf ») : chaque fichier nommé dans
 *   `…/import?file=<content://…>&fileName=<nom>&fileType=<type>` (`sharedReleaseFiles.ts`) ; le JavaScript les
 *   recopie dans le cache de l'app tant que le droit de lecture accordé à l'activité vaut.
 */
object ShareIntake {
  // Les paramètres et les bornes de `@tentacle-tv/shared/octave/mode` (sharedImport.ts, sharedReleaseFiles.ts) :
  // jamais renommés.
  private const val PARAM = "shared"
  private const val MAX = 4096
  private const val FILE = "file"
  private const val FILE_NAME = "fileName"
  private const val FILE_TYPE = "fileType"
  private const val FILES_MAX = 100
  // Le ZIP d'un achat Bandcamp, envoyé tel quel (le serveur l'ouvre).
  private val ARCHIVES = setOf("application/zip", "application/x-zip-compressed")

  fun rewrite(intent: Intent?, resolver: android.content.ContentResolver? = null) {
    if (intent == null) return
    val type = intent.type ?: return
    when {
      intent.action == Intent.ACTION_SEND && type.startsWith("text/") -> {
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.take(MAX) ?: return
        intent.action = Intent.ACTION_VIEW
        intent.data = base().appendQueryParameter(PARAM, text).build()
      }
      (intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE) && (type.startsWith("audio/") || type in ARCHIVES) -> {
        val uris = streamsOf(intent).take(FILES_MAX)
        if (uris.isEmpty()) return
        val builder = base()
        for (uri in uris) {
          builder.appendQueryParameter(FILE, uri.toString())
          builder.appendQueryParameter(FILE_NAME, displayName(resolver, uri) ?: "")
          builder.appendQueryParameter(FILE_TYPE, resolver?.getType(uri) ?: type)
        }
        intent.action = Intent.ACTION_VIEW
        intent.data = builder.build()
      }
    }
  }

  private fun base(): Uri.Builder = Uri.Builder().scheme("tentacle").authority("octave").appendPath("import")

  @Suppress("DEPRECATION")
  private fun streamsOf(intent: Intent): List<Uri> {
    if (intent.action == Intent.ACTION_SEND) {
      val one = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java) else intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
      return listOfNotNull(one)
    }
    val many = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) else intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
    return many?.filterNotNull() ?: emptyList()
  }

  /** Le nom affiché du fichier (« 01 Intro.flac ») ; `null` si le fournisseur ne le dit pas. */
  private fun displayName(resolver: android.content.ContentResolver?, uri: Uri): String? {
    if (resolver == null) return null
    return try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
      }
    } catch (_: Exception) {
      null
    }
  }
}
