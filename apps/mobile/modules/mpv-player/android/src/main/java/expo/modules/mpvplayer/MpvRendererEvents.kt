// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLayerRenderer.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : sélection initiale par ff-index, tampon unifié.
package expo.modules.mpvplayer

import android.util.Log

/**
 * Les rappels de libmpv (thread de libmpv-android) : propriétés observées et
 * événements. Chaque remontée au délégué passe par le thread principal. Les
 * charges utiles ne portent jamais de `null` : l'événement JS est un
 * `Map<String, Any>`.
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
        renderer.updateLoading(false)

        val tracks = renderer.trackList(handle)
        val video = tracks.firstOrNull { it["type"] == "video" && it["selected"] == true } ?: tracks.firstOrNull { it["type"] == "video" }
        val info = mutableMapOf<String, Any>(
            "duration" to (handle.getPropertyDouble("duration") ?: 0.0),
            "tracks" to tracks,
            "width" to (video?.get("width") ?: 0),
            "height" to (video?.get("height") ?: 0),
            "hdr" to renderer.hdrMode(handle),
        )
        handle.getPropertyDouble("container-fps")?.takeIf { it > 0 }?.let { info["fps"] = it }
        handle.getPropertyString("hwdec-current")?.let { info["hwdec"] = it }
        renderer.notify { it.rendererDidLoad(info) }
    }

    fun onLong(renderer: MpvRenderer, property: String, value: Long) {
        if (property != "track-list/count") return
        if (!renderer.fileLoaded) return
        val handle = renderer.mpv ?: return
        val tracks = renderer.trackList(handle)
        renderer.notify { it.rendererDidUpdateTracks(tracks) }
    }

    fun onBoolean(renderer: MpvRenderer, property: String, value: Boolean) {
        when (property) {
            "pause" -> if (value != renderer.isPaused) {
                renderer.isPaused = value
                renderer.notify { it.rendererDidChangePause(value) }
            }
            "paused-for-cache" -> {
                renderer.pausedForCache = value
                renderer.reportBuffering()
            }
            "eof-reached" -> if (value && renderer.fileLoaded) renderer.notify { it.rendererDidEnd() }
        }
    }

    fun onString(renderer: MpvRenderer, property: String, value: String) {
        if (property != "video-params/gamma") return
        if (!renderer.fileLoaded) return
        val handle = renderer.mpv ?: return
        val params = mutableMapOf<String, Any>(
            "width" to (handle.getPropertyInt("video-params/w") ?: 0),
            "height" to (handle.getPropertyInt("video-params/h") ?: 0),
            "hdr" to renderer.hdrMode(handle),
        )
        handle.getPropertyString("hwdec-current")?.let { params["hwdec"] = it }
        renderer.notify { it.rendererDidUpdateVideoParams(params) }
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
        renderer.notify { it.rendererDidProgress(position, duration, cache) }
    }

    fun onEvent(renderer: MpvRenderer, eventId: Int) {
        when (eventId) {
            MPVLib.MPV_EVENT_START_FILE -> renderer.startedCurrentLoad = true
            MPVLib.MPV_EVENT_FILE_LOADED -> onFileLoaded(renderer)
            MPVLib.MPV_EVENT_SEEK -> {
                renderer.isSeeking = true
                renderer.updateLoading(true)
            }
            MPVLib.MPV_EVENT_PLAYBACK_RESTART -> {
                renderer.isSeeking = false
                renderer.updateLoading(false)
            }
            MPVLib.MPV_EVENT_END_FILE -> onEndFile(renderer)
            MPVLib.MPV_EVENT_SHUTDOWN -> Log.w(MpvRenderer.TAG, "mpv arrêté")
        }
    }

    /**
     * libmpv-android ne transmet pas la raison d'END_FILE ; on la déduit. Avant
     * le START_FILE de la demande en cours, c'est l'ancien fichier, arrêté par
     * `loadfile … replace` ou `stop` — rien à dire (le prendre pour un échec
     * faisait relancer chaque rechargement en transcodage). Après, une fin
     * sans `eof-reached` est un échec, à l'ouverture comme en cours de lecture.
     */
    private fun onEndFile(renderer: MpvRenderer) {
        if (!renderer.startedCurrentLoad) return
        renderer.startedCurrentLoad = false
        val eof = renderer.mpv?.getPropertyBoolean("eof-reached") ?: false
        if (eof) return
        val phase = if (renderer.fileLoaded) "en cours de lecture" else "à l'ouverture"
        renderer.fileLoaded = false
        renderer.updateLoading(false)
        Log.e(MpvRenderer.TAG, "échec de lecture ($phase)")
        renderer.notify { it.rendererDidFail("échec de lecture ($phase)") }
    }
}
