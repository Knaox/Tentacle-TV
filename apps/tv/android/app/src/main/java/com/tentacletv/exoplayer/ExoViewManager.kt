package com.tentacletv.exoplayer

import androidx.media3.common.util.UnstableApi
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@UnstableApi
class ExoViewManager : SimpleViewManager<ExoPlayerView>() {

    companion object {
        private const val COMMAND_SEEK = 1
        private const val COMMAND_SET_AUDIO_TRACK = 2
        private const val COMMAND_SET_SUBTITLE_TRACK = 3
        private const val COMMAND_LOAD_SUBTITLE = 4
    }

    override fun getName(): String = "ExoPlayerView"

    override fun createViewInstance(reactContext: ThemedReactContext): ExoPlayerView {
        return ExoPlayerView(reactContext)
    }

    @ReactProp(name = "source")
    fun setSource(view: ExoPlayerView, source: String?) {
        source?.let { view.loadFile(it) }
    }

    @ReactProp(name = "paused")
    fun setPaused(view: ExoPlayerView, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "progressInterval", defaultInt = 1000)
    fun setProgressInterval(view: ExoPlayerView, interval: Int) {
        view.progressInterval = interval.toLong()
    }

    @ReactProp(name = "audioPassthrough", defaultBoolean = true)
    fun setAudioPassthrough(view: ExoPlayerView, enabled: Boolean) {
        view.audioPassthrough = enabled
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onExoEvent",
            MapBuilder.of("registrationName", "onExoEvent")
        )
    }

    override fun getCommandsMap(): Map<String, Int> {
        return mapOf(
            "seek" to COMMAND_SEEK,
            "setAudioTrack" to COMMAND_SET_AUDIO_TRACK,
            "setSubtitleTrack" to COMMAND_SET_SUBTITLE_TRACK,
            "loadSubtitle" to COMMAND_LOAD_SUBTITLE,
        )
    }

    override fun receiveCommand(view: ExoPlayerView, commandId: String?, args: ReadableArray?) {
        when (commandId) {
            "seek" -> args?.getDouble(0)?.let { view.seekTo(it) }
            "setAudioTrack" -> args?.getInt(0)?.let { view.setAudioTrack(it) }
            "setSubtitleTrack" -> args?.getInt(0)?.let { view.setSubtitleTrack(it) }
            "loadSubtitle" -> view.loadSubtitle(args?.getString(0))
        }
    }

    override fun onDropViewInstance(view: ExoPlayerView) {
        view.destroy()
        super.onDropViewInstance(view)
    }
}
