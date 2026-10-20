// Tentacle TV — AGPL-3.0-or-later.
package expo.modules.playerpip

import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle

/** Ce que JS a décidé (règle `pipPolicy.ts`) : la plateforme n'en juge pas. */
data class PipConfig(
  val autoEnter: Boolean,
  val playing: Boolean,
  val aspectWidth: Int,
  val aspectHeight: Int,
  val labels: Map<String, String>,
)

/**
 * L'image dans l'image de l'ACTIVITÉ — toute l'app devient la petite fenêtre,
 * JS n'y montre que l'image. Entrée automatique en quittant l'app pendant une
 * lecture : `setAutoEnterEnabled` (Android 12+), `onUserLeaveHint` avant.
 * Gestes de la fenêtre (lecture/pause, ±10 s) par des `RemoteAction`
 * diffusées à l'app seule. Fermeture de la fenêtre = l'activité arrêtée
 * quand le mode prend fin : `onClosed`, JS quitte le lecteur proprement.
 */
class PipController(
  private val onModeChanged: (Boolean) -> Unit,
  private val onAction: (String) -> Unit,
  private val onClosed: () -> Unit,
) {
  private var activity: ComponentActivity? = null
  private var config: PipConfig? = null
  private var receiverRegistered = false

  private val modeListener = Consumer<PictureInPictureModeChangedInfo> { info ->
    val act = activity ?: return@Consumer
    onModeChanged(info.isInPictureInPictureMode)
    // Fermée par la croix (ou glissée hors de l'écran) : l'activité est déjà
    // arrêtée quand le mode prend fin. Agrandie, elle repasse au premier plan.
    if (!info.isInPictureInPictureMode && act.lifecycle.currentState == Lifecycle.State.CREATED) onClosed()
  }

  private val leaveHintListener = Runnable {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && config?.autoEnter == true) enter()
  }

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      intent.getStringExtra(EXTRA_ACTION)?.let(onAction)
    }
  }

  fun isSupported(context: Context?): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE) == true

  fun isActive(): Boolean = activity?.isInPictureInPictureMode == true

  /** Rattache le contrôleur à l'activité courante (une seule fois par activité). */
  fun attach(act: ComponentActivity) {
    if (activity === act) return
    detach()
    activity = act
    act.addOnPictureInPictureModeChangedListener(modeListener)
    act.addOnUserLeaveHintListener(leaveHintListener)
    if (!receiverRegistered) {
      ContextCompat.registerReceiver(act.applicationContext, receiver, IntentFilter(BROADCAST), ContextCompat.RECEIVER_NOT_EXPORTED)
      receiverRegistered = true
    }
  }

  fun configure(act: ComponentActivity, next: PipConfig) {
    attach(act)
    config = next
    apply()
  }

  /** Le lecteur s'en va : plus d'entrée automatique, plus d'écoute. */
  fun reset() {
    config = config?.copy(autoEnter = false)
    apply()
    config = null
    detach()
  }

  fun enter(): Boolean {
    val act = activity ?: return false
    if (!isSupported(act)) return false
    val params = buildParams(act) ?: return false
    return try { act.enterPictureInPictureMode(params) } catch (e: IllegalStateException) { false }
  }

  private fun detach() {
    activity?.let {
      it.removeOnPictureInPictureModeChangedListener(modeListener)
      it.removeOnUserLeaveHintListener(leaveHintListener)
      if (receiverRegistered) {
        try { it.applicationContext.unregisterReceiver(receiver) } catch (e: IllegalArgumentException) { /* déjà retiré */ }
        receiverRegistered = false
      }
    }
    activity = null
  }

  private fun apply() {
    val act = activity ?: return
    if (!isSupported(act)) return
    val params = buildParams(act) ?: return
    try { act.setPictureInPictureParams(params) } catch (e: IllegalStateException) { /* activité sans PiP */ }
  }

  private fun buildParams(context: Context): PictureInPictureParams? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val cfg = config ?: PipConfig(false, false, 16, 9, emptyMap())
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(Rational(cfg.aspectWidth, cfg.aspectHeight))
      .setActions(actions(context, cfg))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(cfg.autoEnter).setSeamlessResizeEnabled(true)
    }
    return builder.build()
  }

  private fun actions(context: Context, cfg: PipConfig): List<RemoteAction> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return emptyList()
    val toggle = if (cfg.playing) "pause" else "play"
    val toggleIcon = if (cfg.playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    return listOf(
      action(context, "rewind", android.R.drawable.ic_media_rew, cfg, 1),
      action(context, toggle, toggleIcon, cfg, 2),
      action(context, "forward", android.R.drawable.ic_media_ff, cfg, 3),
    )
  }

  private fun action(context: Context, name: String, icon: Int, cfg: PipConfig, requestCode: Int): RemoteAction {
    val intent = Intent(BROADCAST).setPackage(context.packageName).putExtra(EXTRA_ACTION, name)
    val pending = PendingIntent.getBroadcast(
      context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val label = cfg.labels[name] ?: name
    return RemoteAction(Icon.createWithResource(context, icon), label, label, pending)
  }

  companion object {
    private const val BROADCAST = "app.tentacletv.mobile.PIP_ACTION"
    private const val EXTRA_ACTION = "action"
  }
}
