package expo.modules.mpvplayer

import android.util.Log
import java.util.ArrayDeque

/**
 * Le journal natif de mpv, à l'échelle du processus (un seul lecteur vit à la
 * fois). Ce qui vaut d'être gardé — les avertissements et erreurs, les résumés
 * négociés (« AO: [audiotrack] », « VO: [gpu-next] ») et tout ce que dit la
 * sortie audio — reste dans un tampon pour le panneau « Détails » et part aux
 * écouteurs (le module, quand JS écoute `onNativeLog`). Miroir de
 * `MpvLogger.swift`. logcat : le JNI de libmpv-android y écrit déjà TOUT, en
 * verbeux, sous le tag `mpv` (`[cplayer:v] …`, niveau « v » demandé sans
 * condition, release compris) — on n'y redouble que les avertissements et les
 * erreurs, à leur vraie priorité, pour qu'un `logcat mpv:W` les isole.
 */
object MpvLogger : MPVLib.LogObserver {
    // Niveaux mpv (`mpv_log_level`) : fatal 10, error 20, warn 30, info 40, v 50, debug 60, trace 70.
    private const val LEVEL_ERROR = 20
    private const val LEVEL_WARN = 30
    private const val LEVEL_INFO = 40

    private const val CAPACITY = 200
    private const val TAG = "mpv"

    private val recent = ArrayDeque<String>(CAPACITY)
    private val listeners = mutableListOf<(message: String, type: String) -> Unit>()

    fun addListener(listener: (message: String, type: String) -> Unit) {
        synchronized(listeners) { listeners.add(listener) }
    }

    fun removeListener(listener: (message: String, type: String) -> Unit) {
        synchronized(listeners) { listeners.remove(listener) }
    }

    /** Les dernières lignes gardées, de la plus ancienne à la plus récente. */
    fun recent(): List<String> = synchronized(recent) { recent.toList() }

    /** Une ligne à nous (démarrage, surface…), au même titre que celles de mpv. */
    fun log(message: String, type: String = "Info") {
        Log.println(if (type == "Error") Log.ERROR else if (type == "Warning") Log.WARN else Log.INFO, TAG, message)
        keep(message, type)
    }

    override fun logMessage(prefix: String, level: Int, text: String) {
        val line = text.trimEnd()
        if (line.isEmpty()) return
        val priority = when {
            level <= LEVEL_ERROR -> Log.ERROR
            level <= LEVEL_WARN -> Log.WARN
            level <= LEVEL_INFO -> Log.INFO
            else -> Log.DEBUG
        }
        if (priority >= Log.WARN) Log.println(priority, TAG, "[$prefix] $line")
        if (priority == Log.DEBUG) return
        if (priority == Log.INFO && !isDiagnosticInfoLine(prefix, line)) return
        keep("[$prefix] $line", when (priority) { Log.ERROR -> "Error"; Log.WARN -> "Warning"; else -> "Info" })
    }

    /** Même filtre qu'iOS : la sortie audio, et les résumés « AO: » / « VO: ». */
    private fun isDiagnosticInfoLine(prefix: String, text: String): Boolean =
        prefix == "ao" || prefix.startsWith("ao/") || text.startsWith("AO: ") || text.startsWith("VO: ")

    private fun keep(message: String, type: String) {
        synchronized(recent) {
            if (recent.size >= CAPACITY) recent.removeFirst()
            recent.addLast(message)
        }
        val snapshot = synchronized(listeners) { listeners.toList() }
        for (listener in snapshot) listener(message, type)
    }
}
