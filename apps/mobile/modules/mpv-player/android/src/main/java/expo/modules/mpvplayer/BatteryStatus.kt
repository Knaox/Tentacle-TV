// Tentacle TV — fichier propre au projet (AGPL-3.0-or-later), à côté du module
// dérivé de Streamyfin.
package expo.modules.mpvplayer

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager

/**
 * La batterie, lue sur l'annonce collante du système (aucun récepteur gardé,
 * aucune permission). Même contrat qu'iOS : `level` de 0 à 1, -1 inconnu.
 */
internal fun batteryStatus(context: Context?): Map<String, Any> {
    val intent: Intent? = context?.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    return mapOf("level" to if (level >= 0 && scale > 0) level.toDouble() / scale else -1.0, "charging" to charging)
}
