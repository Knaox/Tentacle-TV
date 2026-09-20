// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLayerRenderer.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : sélection initiale par ff-index, tampon unifié.
package expo.modules.mpvplayer

import android.util.Log

/**
 * Les rappels de libmpv (thread de libmpv-android) : propriétés observées et
 * événements. Chaque remontée au délégué passe par le thread principal.
 */
internal object MpvRendererEvents {
    fun onFileLoaded(renderer: MpvRenderer) {
        val handle = renderer.mpv ?: return
        val config = renderer.pendingConfig
        var externalSelected = false
        for (external in config?.externalSubtitles ?: emptyList()) {
            handle.command(arrayOf("sub-add", external.url, if (external.select) "select" else "auto"))
            if (external.select) externalSelected = true
        }
        config?.initialAudioFfIndex?.let { ffIndex ->
            renderer.trackId(handle, ffIndex, "audio")?.let { handle.setPropertyInt("aid", it) }
        }
        val initialSubtitle = config?.initialSubtitleFfIndex?.let { renderer.trackId(handle, it, "sub") }
        when {
            externalSelected -> renderer.applyBidiMode(handle, handle.getPropertyInt("sid") ?: -1)
            initialSubtitle != null -> {
                handle.setPropertyInt("sid", initialSubtitle)
                renderer.applyBidiMode(handle, initialSubtitle)
            }
            else -> handle.setPropertyString("sid", "no")
        }
        renderer.fileLoaded = true
        renderer.isSeeking = false
        renderer.setLoading(false)

        val tracks = renderer.trackList(handle)
        val video = tracks.firstOrNull { it["type"] == "video" && it["selected"] == true } ?: tracks.firstOrNull { it["type"] == "video" }
        val info = mutableMapOf<String, Any?>(
            "duration" to (handle.getPropertyDouble("duration") ?: 0.0),
            "tracks" to tracks,
            "width" to (video?.get("width") ?: 0),
            "height" to (video?.get("height") ?: 0),
            "hdr" to renderer.hdrMode(handle),
        )
        handle.getPropertyDouble("container-fps")?.takeIf { it > 0 }?.let { info["fps"] = it }
        handle.getPropertyString("hwdec-current")?.let { info["hwdec"] = it }
        renderer.notify { it.onLoad(info) }
    }

    fun onLong(renderer: MpvRenderer, property: String, value: Long) {
        if (property != "track-list/count") return
        if (!renderer.fileLoaded) return
        val handle = renderer.mpv ?: return
        val tracks = renderer.trackList(handle)
        renderer.notify { it.onTracksChanged(tracks) }
    }

    fun onBoolean(renderer: MpvRenderer, property: String, value: Boolean) {
        when (property) {
            "pause" -> if (value != renderer.isPaused) {
                renderer.isPaused = value
                renderer.notify { it.onPauseChanged(value) }
            }
            "paused-for-cache" -> {
                renderer.pausedForCache = value
                renderer.reportBuffering()
            }
            "eof-reached" -> if (value && renderer.fileLoaded) renderer.notify { it.onEnd() }
        }
    }

    fun onString(renderer: MpvRenderer, property: String, value: String) {
        if (property != "video-params/gamma") return
        if (!renderer.fileLoaded) return
        val handle = renderer.mpv ?: return
        val params = mapOf<String, Any?>(
            "width" to (handle.getPropertyInt("video-params/w") ?: 0),
            "height" to (handle.getPropertyInt("video-params/h") ?: 0),
            "hdr" to renderer.hdrMode(handle),
            "hwdec" to handle.getPropertyString("hwdec-current"),
        )
        renderer.notify { it.onVideoParams(params) }
    }

    fun onDouble(renderer: MpvRenderer, property: String, value: Double) {
        when (property) {
            "duration" -> {
                renderer.cachedDuration = value
                notifyPosition(renderer)
            }
            "time-pos" -> {
                renderer.cachedPosition = value
                val now = System.currentTimeMillis()
                if (renderer.isSeeking || now - renderer.lastProgressUpdateTime >= 500) {
                    renderer.lastProgressUpdateTime = now
                    notifyPosition(renderer)
                }
            }
            "demuxer-cache-duration" -> renderer.cachedCacheSeconds = value
        }
    }

    private fun notifyPosition(renderer: MpvRenderer) {
        val position = renderer.cachedPosition
        val duration = renderer.cachedDuration
        val cache = renderer.cachedCacheSeconds
        renderer.notify { it.onPosition(position, duration, cache) }
    }

    fun onEvent(renderer: MpvRenderer, eventId: Int) {
        when (eventId) {
            MPVLib.MPV_EVENT_FILE_LOADED -> onFileLoaded(renderer)
            MPVLib.MPV_EVENT_SEEK -> {
                renderer.isSeeking = true
                renderer.setLoading(true)
            }
            MPVLib.MPV_EVENT_PLAYBACK_RESTART -> {
                renderer.isSeeking = false
                renderer.setLoading(false)
            }
            MPVLib.MPV_EVENT_END_FILE -> {
                // libmpv-android ne transmet pas la raison : une fin sans
                // `eof-reached` pendant un chargement est un échec de lecture.
                val eof = renderer.mpv?.getPropertyBoolean("eof-reached") ?: false
                if (!eof && renderer.isLoading && !renderer.fileLoaded) {
                    renderer.setLoading(false)
                    Log.e(MpvRenderer.TAG, "échec de lecture (END_FILE sans EOF)")
                    renderer.notify { it.onError("échec de lecture") }
                }
            }
            MPVLib.MPV_EVENT_SHUTDOWN -> Log.w(MpvRenderer.TAG, "mpv arrêté")
        }
    }
}
