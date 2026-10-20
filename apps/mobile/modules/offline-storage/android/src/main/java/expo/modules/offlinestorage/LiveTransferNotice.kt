package expo.modules.offlinestorage

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Le suivi EN DIRECT d'un lot de transferts : ce que la notification des
 * transferts dit quand le JavaScript la tient (réglage « Suivi en direct ») —
 * le titre ou le compte, l'état en toutes lettres (« Prêt dans 12 min »,
 * « En attente du Wi-Fi »), la barre, et un COMPTE À REBOURS natif
 * (chronomètre décroissant) qui avance seul, application suspendue comprise.
 *
 * Elle vit sur la MÊME notification que le service de premier plan
 * (`OfflineTransferService.NOTIFICATION_ID`, même canal) : jamais deux
 * notifications pour un même transfert. Service arrêté (réglage « Continuer
 * en arrière-plan » coupé, refusé par Android, ou lot qui attend le Wi-Fi),
 * elle est posée seule sous `LIVE_NOTIFICATION_ID`, permanente, sans bouton
 * « Pause » — personne ne l'écouterait.
 *
 * Le natif ne décide de rien : pas d'horloge, pas d'estimation. Il affiche ce
 * que le JavaScript lui donne (`livePublish.ts` d'offline-core).
 */
object LiveTransferNotice {
  data class Content(
    val title: String,
    val text: String,
    val subText: String?,
    /** 0-100, ou négatif sans taille connue (barre indéterminée). */
    val progress: Int,
    /** Fin estimée (epoch ms) pour le compte à rebours ; 0 : pas de compte à rebours. */
    val endsAtMs: Long,
    val deepLink: String?,
  )

  @Volatile var content: Content? = null
    private set

  /**
   * Pose ou met à jour le suivi ; `false` sans permission de notifier — Android
   * avale alors la notification sans rien dire, et le JavaScript la reposera
   * au retour au premier plan (permission accordée entre-temps).
   */
  fun show(context: Context, channelName: String, next: Content): Boolean {
    content = next
    return try {
      OfflineTransferService.ensureChannel(context, channelName)
      val manager = NotificationManagerCompat.from(context)
      if (OfflineTransferService.running) {
        manager.notify(OfflineTransferService.NOTIFICATION_ID, OfflineTransferService.buildCurrent(context))
        manager.cancel(OfflineTransferService.LIVE_NOTIFICATION_ID)
      } else {
        manager.notify(OfflineTransferService.LIVE_NOTIFICATION_ID, OfflineTransferService.buildCurrent(context, withPause = false))
      }
      manager.areNotificationsEnabled()
    } catch (e: SecurityException) {
      false
    }
  }

  /** Retire le suivi ; la notification du service, s'il tourne encore, reprend son texte simple. */
  fun hide(context: Context): Boolean {
    content = null
    return try {
      val manager = NotificationManagerCompat.from(context)
      manager.cancel(OfflineTransferService.LIVE_NOTIFICATION_ID)
      if (OfflineTransferService.running) {
        manager.notify(OfflineTransferService.NOTIFICATION_ID, OfflineTransferService.buildCurrent(context))
      }
      true
    } catch (e: SecurityException) {
      false
    }
  }

  /** Habille la notification avec le suivi, s'il y en a un. */
  fun apply(context: Context, builder: NotificationCompat.Builder): Boolean {
    val live = content ?: return false
    builder
      .setContentTitle(live.title)
      .setContentText(live.text)
      .setSubText(live.subText)
      .setProgress(100, live.progress.coerceIn(0, 100), live.progress < 0)
    if (live.endsAtMs > 0) {
      // Le chronomètre décroissant avance seul : rien à republier chaque seconde.
      builder.setWhen(live.endsAtMs).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true)
    } else {
      builder.setShowWhen(false).setUsesChronometer(false)
    }
    live.deepLink?.let { link ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).setPackage(context.packageName)
      builder.setContentIntent(
        PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
    }
    return true
  }
}
