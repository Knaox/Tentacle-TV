package com.tentacletv.mpv

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Ce que mpv a chargé, pour la sonde (`probe/PlayerLoadProbe.kt`) : la fin du
 * cache du démuxeur (`demuxer-cache-time`, en secondes du média) — mpv ne
 * compte pas les octets reçus ; la sonde se contente de voir la mémoire
 * avancer (`loadGrew` : plus d'une demi-seconde) —, et l'état de lecture.
 */
fun mpvLoadState(handle: MPVLib?, opened: Boolean): WritableMap? {
    val mpv = handle ?: return null
    if (!opened) return null
    val paused = mpv.getPropertyBoolean("pause") == true
    val waiting = mpv.getPropertyBoolean("paused-for-cache") == true
    val ready = mpv.getPropertyDouble("time-pos") != null
    return Arguments.createMap().apply {
        putDouble("loadedEnd", mpv.getPropertyDouble("demuxer-cache-time") ?: 0.0)
        putDouble("bytes", 0.0)
        putInt("requests", 0)
        putBoolean("ready", ready)
        putBoolean("failed", false)
        putDouble("rate", if (!paused && !waiting && ready) mpv.getPropertyDouble("speed") ?: 1.0 else 0.0)
        putInt("control", if (paused) 0 else if (waiting || !ready) 1 else 2)
        if (waiting) putString("waiting", "cache")
        putBoolean("keepUp", !waiting && ready)
    }
}
