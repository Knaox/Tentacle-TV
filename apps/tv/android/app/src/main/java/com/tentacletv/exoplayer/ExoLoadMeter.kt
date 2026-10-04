package com.tentacletv.exoplayer

import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.source.LoadEventInfo
import androidx.media3.exoplayer.source.MediaLoadData
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Ce qu'ExoPlayer a chargé, pour la sonde (`probe/PlayerLoadProbe.kt`) : les
 * octets et les requêtes de média terminées depuis l'ouverture (remis à zéro à
 * chaque média), la fin de la mémoire chargée, l'état de lecture.
 */
@UnstableApi
class ExoLoadMeter : AnalyticsListener {
    private var bytes = 0L
    private var requests = 0

    fun reset() {
        bytes = 0L
        requests = 0
    }

    override fun onLoadCompleted(eventTime: AnalyticsListener.EventTime, loadEventInfo: LoadEventInfo, mediaLoadData: MediaLoadData) {
        if (loadEventInfo.bytesLoaded > 0) bytes += loadEventInfo.bytesLoaded
        requests++
    }

    fun state(player: ExoPlayer?): WritableMap? {
        val p = player ?: return null
        if (p.currentMediaItem == null) return null
        val buffering = p.playbackState == Player.STATE_BUFFERING
        return Arguments.createMap().apply {
            putDouble("loadedEnd", p.bufferedPosition / 1000.0)
            putDouble("bytes", bytes.toDouble())
            putInt("requests", requests)
            putBoolean("ready", p.playbackState == Player.STATE_READY)
            putBoolean("failed", p.playerError != null)
            putDouble("rate", if (p.isPlaying) p.playbackParameters.speed.toDouble() else 0.0)
            // 0 pause, 1 attente, 2 lecture — le code de tvOS (timeControlStatus).
            putInt("control", if (!p.playWhenReady) 0 else if (p.isPlaying) 2 else 1)
            if (buffering) putString("waiting", "buffering")
            putBoolean("keepUp", p.playbackState == Player.STATE_READY)
        }
    }
}
