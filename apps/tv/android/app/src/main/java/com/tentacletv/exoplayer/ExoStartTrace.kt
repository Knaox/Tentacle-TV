package com.tentacletv.exoplayer

import android.os.SystemClock
import android.util.Log
import androidx.media3.common.Format
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DecoderReuseEvaluation
import androidx.media3.exoplayer.analytics.AnalyticsListener

/**
 * Le DÉMARRAGE d'une lecture, raconté dans logcat (`adb logcat -s TntStart`) :
 * chaque jalon en millisecondes depuis l'ouverture du média — prêt, première
 * image posée sur la surface, son qui avance réellement (l'AudioTrack joue),
 * images perdues. Quelques lignes par lecture, rien par image : c'est ce qui
 * dit, sur la vraie Shield, dans quel ordre l'image et le son arrivent.
 */
@UnstableApi
class ExoStartTrace : AnalyticsListener {
    private var openedAt = 0L
    private var dropped = 0

    fun reset(label: String) {
        openedAt = SystemClock.elapsedRealtime()
        dropped = 0
        log("ouverture $label")
    }

    private fun at(eventTime: AnalyticsListener.EventTime): Long = eventTime.realtimeMs - openedAt

    private fun log(message: String) = Log.w(TAG, message)

    override fun onPlaybackStateChanged(eventTime: AnalyticsListener.EventTime, state: Int) {
        val name = when (state) {
            Player.STATE_BUFFERING -> "attente"; Player.STATE_READY -> "prêt"
            Player.STATE_ENDED -> "fin"; else -> "repos"
        }
        log("+${at(eventTime)} ms état=$name")
    }

    override fun onIsPlayingChanged(eventTime: AnalyticsListener.EventTime, isPlaying: Boolean) {
        log("+${at(eventTime)} ms lecture=${if (isPlaying) "oui" else "non"}")
    }

    override fun onRenderedFirstFrame(eventTime: AnalyticsListener.EventTime, output: Any, renderTimeMs: Long) {
        log("+${at(eventTime)} ms première image")
    }

    override fun onAudioPositionAdvancing(eventTime: AnalyticsListener.EventTime, playoutStartSystemTimeMs: Long) {
        // L'heure où le son a réellement commencé à sortir — Media3 la donne en
        // heure murale (`System.currentTimeMillis`), ramenée ici à l'horloge du
        // démarrage (`elapsedRealtime`).
        val start = playoutStartSystemTimeMs - (System.currentTimeMillis() - SystemClock.elapsedRealtime()) - openedAt
        log("+${at(eventTime)} ms son qui avance (sorti à +$start ms)")
    }

    override fun onAudioInputFormatChanged(eventTime: AnalyticsListener.EventTime, format: Format, decoderReuseEvaluation: DecoderReuseEvaluation?) {
        log("+${at(eventTime)} ms son ${format.sampleMimeType} ${format.channelCount} canaux")
    }

    override fun onVideoInputFormatChanged(eventTime: AnalyticsListener.EventTime, format: Format, decoderReuseEvaluation: DecoderReuseEvaluation?) {
        log("+${at(eventTime)} ms image ${format.sampleMimeType} ${format.width}×${format.height} ${format.frameRate} i/s")
    }

    override fun onDroppedVideoFrames(eventTime: AnalyticsListener.EventTime, droppedFrames: Int, elapsedMs: Long) {
        dropped += droppedFrames
        log("+${at(eventTime)} ms $droppedFrames image(s) perdue(s) en $elapsedMs ms (total $dropped)")
    }

    override fun onAudioUnderrun(eventTime: AnalyticsListener.EventTime, bufferSize: Int, bufferSizeMs: Long, elapsedSinceLastFeedMs: Long) {
        log("+${at(eventTime)} ms son en rupture")
    }

    companion object {
        const val TAG = "TntStart"
    }
}
