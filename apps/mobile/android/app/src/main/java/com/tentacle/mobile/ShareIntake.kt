package com.tentacle.mobile

import android.content.Intent
import android.net.Uri

/**
 * Le PARTAGE SYSTÈME vers Tentacle TV (intent `SEND`, texte) : le texte reçu est rendu TEL QUEL dans le lien
 * profond `tentacle://octave/import?shared=<texte>`, et l'intent devient un `VIEW` — la seule forme que
 * React Native lit (lien initial, puis évènement `url`). Le JavaScript y trouve le lien de playlist
 * (`sharedImportLink`, shared). Source : `apps/mobile/targets/ShareIntakeAndroid/`, recopiée par le config
 * plugin `withShareToTentacle` — jamais retouchée dans `android/`.
 */
object ShareIntake {
  // Le paramètre et la borne de `@tentacle-tv/shared/octave/mode` (sharedImport.ts) : jamais renommés.
  private const val PARAM = "shared"
  private const val MAX = 4096

  fun rewrite(intent: Intent?) {
    if (intent == null || intent.action != Intent.ACTION_SEND) return
    if (intent.type?.startsWith("text/") != true) return
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.take(MAX) ?: return
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.Builder().scheme("tentacle").authority("octave").appendPath("import").appendQueryParameter(PARAM, text).build()
  }
}
