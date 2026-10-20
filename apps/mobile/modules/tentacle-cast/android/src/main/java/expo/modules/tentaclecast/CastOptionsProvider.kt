// Tentacle TV — AGPL-3.0-or-later (lié aux Google Play services par LICENSE-EXCEPTIONS §2).
package expo.modules.tentaclecast

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions
import com.google.android.gms.cast.framework.media.MediaIntentReceiver
import com.google.android.gms.cast.framework.media.NotificationOptions

/**
 * Les options de Google Cast : le récepteur média PAR DÉFAUT de Google (aucune
 * application de réception à enregistrer ni à héberger), et la notification
 * de contrôle (reculer, lecture/pause, avancer de 10 s, arrêter la diffusion),
 * qui rouvre l'app là où elle en était.
 */
class CastOptionsProvider : OptionsProvider {
  override fun getCastOptions(context: Context): CastOptions {
    val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component?.className
    val notification = NotificationOptions.Builder()
      .setActions(
        listOf(
          MediaIntentReceiver.ACTION_REWIND,
          MediaIntentReceiver.ACTION_TOGGLE_PLAYBACK,
          MediaIntentReceiver.ACTION_FORWARD,
          MediaIntentReceiver.ACTION_STOP_CASTING,
        ),
        intArrayOf(1, 3),
      )
      .setSkipStepMs(SKIP_MS)
      .apply { if (launcher != null) setTargetActivityClassName(launcher) }
      .build()
    val media = CastMediaOptions.Builder()
      .setNotificationOptions(notification)
      .setMediaSessionEnabled(true)
      .apply { if (launcher != null) setExpandedControllerActivityClassName(launcher) }
      .build()
    return CastOptions.Builder()
      .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
      .setCastMediaOptions(media)
      .setStopReceiverApplicationWhenEndingSession(true)
      .build()
  }

  override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null

  companion object {
    /** Les sauts de la notification : ceux de l'image dans l'image et d'AVKit. */
    const val SKIP_MS = 10_000L
  }
}
