package expo.modules.offlinestorage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Le service de premier plan qui tient l'application vivante pendant un
 * transfert hors ligne : sans lui, écran éteint ou application derrière,
 * Android suspend le processus et le flux avec lui. Il ne vit QUE pendant
 * qu'un transfert tourne (le JavaScript le démarre et l'arrête), avec une
 * notification discrète (canal à importance basse, sans son) dont le corps
 * est mis à jour par le JavaScript.
 *
 * Android 15 limite le type `dataSync` à six heures par jour : à l'échéance,
 * `onTimeout` arrête le service proprement — le transfert continue en
 * processus tant que l'application vit.
 *
 * La notification porte une barre de progression et un bouton « Pause » :
 * l'écran verrouillé, c'est le seul endroit où l'on peut voir et arrêter un
 * transfert. L'appui est relayé au JavaScript, à qui appartient la file — le
 * service ne décide de rien tout seul.
 */
class OfflineTransferService : Service() {
  companion object {
    const val CHANNEL_ID = "offline_transfers"
    const val NOTIFICATION_ID = 4471
    /** L'action du bouton « Pause » de la notification, relayée au JavaScript. */
    const val ACTION_PAUSE = "expo.modules.offlinestorage.PAUSE_TRANSFERS"
    private const val EXTRA_CHANNEL_NAME = "channelName"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"
    private const val EXTRA_PROGRESS = "progress"
    private const val EXTRA_PAUSE_LABEL = "pauseLabel"
    /** Progression inconnue (taille non annoncée) : barre indéterminée. */
    private const val PROGRESS_UNKNOWN = -1

    @Volatile var running = false
      private set
    @Volatile private var lastTitle = ""
    @Volatile private var lastChannelName = ""
    @Volatile private var lastPauseLabel = ""
    @Volatile private var lastProgress = PROGRESS_UNKNOWN
    /** Ce que le module branche pour recevoir l'appui sur « Pause ». */
    @Volatile var onPauseRequested: (() -> Unit)? = null

    /** Démarre le service ; `false` si Android refuse (depuis l'arrière-plan, quota). */
    fun start(
      context: Context,
      channelName: String,
      title: String,
      body: String,
      pauseLabel: String,
    ): Boolean {
      return try {
        val intent = Intent(context, OfflineTransferService::class.java)
          .putExtra(EXTRA_CHANNEL_NAME, channelName)
          .putExtra(EXTRA_TITLE, title)
          .putExtra(EXTRA_BODY, body)
          .putExtra(EXTRA_PAUSE_LABEL, pauseLabel)
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    /** Corps et progression (0-100, ou négatif si la taille est inconnue). */
    fun update(context: Context, body: String, progress: Int): Boolean {
      if (!running) return false
      lastProgress = progress
      return try {
        NotificationManagerCompat.from(context)
          .notify(NOTIFICATION_ID, build(context, lastTitle, body, progress))
        true
      } catch (e: SecurityException) {
        false
      }
    }

    fun stop(context: Context): Boolean {
      return try {
        context.stopService(Intent(context, OfflineTransferService::class.java))
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
        true
      } catch (e: Exception) {
        false
      }
    }

    private fun ensureChannel(context: Context, name: String) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW).apply {
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }

    private fun build(
      context: Context,
      title: String,
      body: String,
      progress: Int = PROGRESS_UNKNOWN,
    ): Notification {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val pending = launch?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }
      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle(title)
        .setContentText(body)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        // Tant que la taille attendue n'est pas connue, la barre tourne sans
        // mentir sur une avance qu'on ne sait pas mesurer.
        .setProgress(100, progress.coerceIn(0, 100), progress < 0)
      if (pending != null) builder.setContentIntent(pending)
      if (lastPauseLabel.isNotEmpty()) {
        val pause = PendingIntent.getBroadcast(
          context,
          1,
          Intent(ACTION_PAUSE).setPackage(context.packageName),
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        builder.addAction(android.R.drawable.ic_media_pause, lastPauseLabel, pause)
      }
      return builder.build()
    }
  }

  /** L'appui sur « Pause » : le service ne fait que le relayer au JavaScript. */
  private val pauseReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == ACTION_PAUSE) onPauseRequested?.invoke()
    }
  }
  private var receiverRegistered = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val channelName = intent?.getStringExtra(EXTRA_CHANNEL_NAME) ?: lastChannelName.ifEmpty { "Transfers" }
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: lastTitle
    val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
    lastChannelName = channelName
    lastTitle = title
    intent?.getStringExtra(EXTRA_PAUSE_LABEL)?.let { lastPauseLabel = it }
    val progress = intent?.getIntExtra(EXTRA_PROGRESS, PROGRESS_UNKNOWN) ?: lastProgress
    lastProgress = progress
    try {
      ensureChannel(this, channelName)
      if (!receiverRegistered) {
        ContextCompat.registerReceiver(
          this,
          pauseReceiver,
          IntentFilter(ACTION_PAUSE),
          ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        receiverRegistered = true
      }
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
      ServiceCompat.startForeground(this, NOTIFICATION_ID, build(this, title, body, progress), type)
      running = true
    } catch (e: Exception) {
      running = false
      stopSelf()
    }
    // Relancé sans son moteur JavaScript, le service ne servirait à rien.
    return START_NOT_STICKY
  }

  /** Android 15 : le quota `dataSync` est épuisé — on s'efface proprement. */
  override fun onTimeout(startId: Int, fgsType: Int) {
    finish()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    finish()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    running = false
    if (receiverRegistered) {
      runCatching { unregisterReceiver(pauseReceiver) }
      receiverRegistered = false
    }
    super.onDestroy()
  }

  private fun finish() {
    running = false
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }
}
