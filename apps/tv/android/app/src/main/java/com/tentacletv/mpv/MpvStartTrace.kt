package com.tentacletv.mpv

import android.os.SystemClock
import android.util.Log

/**
 * Le DÉMARRAGE d'une lecture mpv, raconté dans logcat (`adb logcat -s
 * TntStart`), comme `ExoStartTrace` : fichier chargé, première position,
 * format de l'image, reprise de la lecture (`playback-restart` : image ET son
 * prêts), pause — en millisecondes depuis le `loadfile`.
 */
internal class MpvStartTrace {
    private var openedAt = 0L
    private var firstPosition = false

    fun reset(label: String) {
        openedAt = SystemClock.elapsedRealtime()
        firstPosition = false
        log("ouverture $label")
    }

    private fun since(): Long = SystemClock.elapsedRealtime() - openedAt

    fun log(message: String) = Log.w("TntStart", "+${since()} ms $message")

    fun event(eventId: Int) {
        when (eventId) {
            MPVLib.MPV_EVENT_FILE_LOADED -> log("fichier chargé")
            MPVLib.MPV_EVENT_PLAYBACK_RESTART -> log("lecture prête (playback-restart)")
        }
    }

    fun position(value: Double) {
        if (firstPosition) return
        firstPosition = true
        log("première position $value s")
    }
}
