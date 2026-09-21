package com.tentacletv.exoplayer

import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

/** Une piste telle que le JS la voit (`MpvTrack`), avec son adresse ExoPlayer. */
data class TrackInfo(
    val id: Int, val type: String, val lang: String, val title: String,
    val codec: String, val isDefault: Boolean, val isSelected: Boolean,
    val groupIndex: Int, val trackIndex: Int,
)

/**
 * Les évènements `onExoEvent` vers le JS — un seul canal, discriminé par
 * `type` (load, end, error, tracks, videoSize, subtitles, progress).
 */
class ExoEventEmitter(
    private val reactContext: ThemedReactContext,
    /** L'identifiant React de la vue, lu à l'émission (posé après la création). */
    private val viewId: () -> Int,
) {
    companion object {
        private const val TAG = "ExoPlayerView"
    }

    /** Faux après `destroy()` : plus rien ne part vers un JS qui a démonté la vue. */
    @Volatile var enabled = true

    fun emit(type: String, data: WritableMap) {
        data.putString("type", type)
        UiThreadUtil.runOnUiThread {
            if (!enabled) return@runOnUiThread
            try {
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(viewId(), "onExoEvent", data)
            } catch (e: Exception) {
                Log.e(TAG, ">>> emitEvent FAILED for $type", e)
            }
        }
    }
}

/**
 * La liste des pistes ExoPlayer, sous la forme que le JS attend, plus
 * l'adressage interne (groupe + index) pour `setAudioTrack` / `setSubtitleTrack`.
 */
@UnstableApi
fun buildTrackList(tracks: Tracks): Pair<List<TrackInfo>, WritableArray> {
    val list = mutableListOf<TrackInfo>()
    val arr = Arguments.createArray()
    var audioId = 1
    var subId = 1

    for ((gi, group) in tracks.groups.withIndex()) {
        val tg = group.mediaTrackGroup
        for (ti in 0 until tg.length) {
            val fmt = tg.getFormat(ti)
            val sel = group.isTrackSelected(ti)
            val type = when (tg.type) {
                C.TRACK_TYPE_AUDIO -> "audio"
                C.TRACK_TYPE_TEXT -> "sub"
                C.TRACK_TYPE_VIDEO -> "video"
                else -> continue
            }
            val id = when (type) { "audio" -> audioId++; "sub" -> subId++; else -> 0 }
            val info = TrackInfo(id, type, fmt.language ?: "", fmt.label ?: "",
                fmt.codecs ?: fmt.sampleMimeType ?: "", sel, sel, gi, ti)
            list.add(info)
            arr.pushMap(Arguments.createMap().apply {
                putInt("id", info.id); putString("type", info.type)
                putString("lang", info.lang); putString("title", info.title)
                putString("codec", info.codec)
                // nativeId = Format.id : pour les pistes texte side-loadées,
                // c'est "jf:<jellyfinIndex>" injecté via SubtitleConfiguration
                // .setId ; pour les pistes EMBARQUÉES du conteneur, un id nu
                // (numéro de piste Matroska) — le préfixe les discrimine.
                putString("nativeId", fmt.id ?: "")
                putBoolean("default", info.isDefault); putBoolean("selected", info.isSelected)
            })
            Log.w("ExoPlayerView", ">>> track[$gi/$ti] type=$type lang=${info.lang} codec=${info.codec} sel=$sel")
        }
    }
    return Pair(list, arr)
}
