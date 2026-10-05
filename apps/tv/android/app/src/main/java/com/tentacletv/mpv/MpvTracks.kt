package com.tentacletv.mpv

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray

/** Les pistes du fichier en cours, telles que le JS les attend (`tracks`) ; null si mpv ne répond pas. */
internal fun mpvTrackList(handle: MPVLib): WritableArray? {
    return try {
        val count = handle.getPropertyInt("track-list/count") ?: return null
        val tracks = Arguments.createArray()
        for (i in 0 until count) {
            val id = handle.getPropertyInt("track-list/$i/id") ?: continue
            tracks.pushMap(Arguments.createMap().apply {
                putInt("id", id)
                putString("type", handle.getPropertyString("track-list/$i/type") ?: "")
                putString("lang", handle.getPropertyString("track-list/$i/lang") ?: "")
                putString("title", handle.getPropertyString("track-list/$i/title") ?: "")
                putString("codec", handle.getPropertyString("track-list/$i/codec") ?: "")
                putBoolean("default", handle.getPropertyBoolean("track-list/$i/default") ?: false)
                putBoolean("selected", handle.getPropertyBoolean("track-list/$i/selected") ?: false)
            })
        }
        Log.w("MpvPlayerView", ">>> sendTrackList emitted $count tracks")
        tracks
    } catch (e: Exception) {
        Log.e("MpvPlayerView", ">>> sendTrackList FAILED", e)
        null
    }
}
