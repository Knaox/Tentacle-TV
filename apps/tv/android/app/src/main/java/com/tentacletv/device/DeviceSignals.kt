package com.tentacletv.device

import android.app.ActivityManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.Display
import java.util.concurrent.Executors
import java.util.concurrent.Future

/**
 * Ce que l'appareil dit de lui — les SIGNAUX du niveau de rendu (tv-core
 * `device/renderTier`, qui décide : ce fichier ne fait que lire). Lus une
 * fois, dès `Application.onCreate`, sur un fil à part : ils sont prêts bien
 * avant que le JS ne les demande (`TentacleDevice.getConstants`), donc avant
 * la première image — le premier écran est déjà dans le bon mode.
 */
internal object DeviceSignals {
  const val TAG = "TentacleLite"

  data class Snapshot(
    val lowRamDevice: Boolean?,
    val totalRamMb: Long?,
    val memoryClassMb: Int?,
    val cpu: CpuProbe.Cpu,
    val soc: String?,
    val sdkInt: Int,
    val displayWidth: Int?,
    val displayHeight: Int?,
    val fingerprint: String,
    val readMs: Long,
  ) {
    /** L'empreinte du système ET la résolution : un changement relance le micro-test. */
    val signature: String get() = "$fingerprint|${displayWidth}x$displayHeight"

    fun toMap(): Map<String, Any?> = mapOf(
      "lowRamDevice" to lowRamDevice,
      "totalRamMb" to totalRamMb?.toDouble(),
      "memoryClassMb" to memoryClassMb,
      "coreCount" to cpu.coreCount,
      "maxFreqMhz" to cpu.maxFreqMhz,
      "coreIds" to cpu.coreIds,
      "soc" to soc,
      "sdkInt" to sdkInt,
      "display" to if (displayWidth != null && displayHeight != null) mapOf("width" to displayWidth, "height" to displayHeight) else null,
    )
  }

  private val executor = Executors.newSingleThreadExecutor { Thread(it, "TentacleDeviceSignals") }
  @Volatile private var pending: Future<Snapshot>? = null

  /** Lance la lecture (Application.onCreate) ; idempotent. */
  @Synchronized
  fun prime(context: Context) {
    if (pending == null) {
      val app = context.applicationContext
      pending = executor.submit<Snapshot> { read(app) }
    }
  }

  /** Les signaux ; attend la lecture lancée par `prime` (finie depuis longtemps en pratique). */
  fun get(context: Context): Snapshot {
    prime(context)
    return pending!!.get()
  }

  private fun read(context: Context): Snapshot {
    val start = SystemClock.elapsedRealtime()
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val memory = am?.let { ActivityManager.MemoryInfo().also(it::getMemoryInfo) }
    val display = try {
      (context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager)?.getDisplay(Display.DEFAULT_DISPLAY)?.mode
    } catch (_: Throwable) {
      null
    }
    val cpu = CpuProbe.read()
    val snapshot = Snapshot(
      lowRamDevice = am?.isLowRamDevice,
      totalRamMb = memory?.totalMem?.takeIf { it > 0 }?.let { it / (1024 * 1024) },
      memoryClassMb = am?.memoryClass,
      cpu = cpu,
      soc = socName(cpu.hardware),
      sdkInt = Build.VERSION.SDK_INT,
      displayWidth = display?.physicalWidth,
      displayHeight = display?.physicalHeight,
      fingerprint = Build.FINGERPRINT ?: "",
      readMs = SystemClock.elapsedRealtime() - start,
    )
    Log.i(TAG, "signaux (${snapshot.readMs} ms) : ${snapshot.toMap()}")
    return snapshot
  }

  /** `Build.SOC_MODEL` dès l'API 31, sinon `ro.board.platform`, sinon le « Hardware » du noyau, sinon `Build.HARDWARE`. */
  private fun socName(kernelHardware: String?): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val model = Build.SOC_MODEL
      if (!model.isNullOrBlank() && model != Build.UNKNOWN) return listOf(Build.SOC_MANUFACTURER, model).filter { !it.isNullOrBlank() && it != Build.UNKNOWN }.joinToString(" ")
    }
    return SystemProps.get("ro.board.platform")?.takeIf { it.isNotBlank() } ?: kernelHardware ?: Build.HARDWARE
  }
}

/** `android.os.SystemProperties` est caché du SDK : lu par réflexion. */
internal object SystemProps {
  fun get(name: String): String? = try {
    Class.forName("android.os.SystemProperties").getMethod("get", String::class.java).invoke(null, name) as? String
  } catch (_: Throwable) {
    null
  }
}
