package com.tentacletv.mpv

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MpvViewManager : SimpleViewManager<MpvPlayerView>() {

    companion object {
        private const val COMMAND_SEEK = 1
        private const val COMMAND_SET_AUDIO_TRACK = 2
        private const val COMMAND_SET_SUBTITLE_TRACK = 3
        private const val COMMAND_ADD_SUBTITLE_TRACK = 4
    }

    override fun getName(): String = "MpvPlayerView"

    override fun createViewInstance(reactContext: ThemedReactContext): MpvPlayerView {
        return MpvPlayerView(reactContext)
    }

    @ReactProp(name = "source")
    fun setSource(view: MpvPlayerView, source: String?) {
        source?.let { view.loadFile(it) }
    }

    @ReactProp(name = "paused")
    fun setPaused(view: MpvPlayerView, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "progressInterval", defaultInt = 1000)
    fun setProgressInterval(view: MpvPlayerView, interval: Int) {
        view.progressInterval = interval.toLong()
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onMpvEvent",
            MapBuilder.of("registrationName", "onMpvEvent")
        )
    }

    override fun getCommandsMap(): Map<String, Int> {
        return mapOf(
            "seek" to COMMAND_SEEK,
            "setAudioTrack" to COMMAND_SET_AUDIO_TRACK,
            "setSubtitleTrack" to COMMAND_SET_SUBTITLE_TRACK,
            "addSubtitleTrack" to COMMAND_ADD_SUBTITLE_TRACK,
        )
    }

    override fun receiveCommand(view: MpvPlayerView, commandId: String?, args: ReadableArray?) {
        when (commandId) {
            "seek" -> args?.getDouble(0)?.let { view.seekTo(it) }
            "setAudioTrack" -> args?.getInt(0)?.let { view.setAudioTrack(it) }
            "setSubtitleTrack" -> args?.getInt(0)?.let { view.setSubtitleTrack(it) }
            "addSubtitleTrack" -> args?.getString(0)?.let { view.addSubtitleTrack(it) }
        }
    }

    override fun onDropViewInstance(view: MpvPlayerView) {
        view.destroy()
        super.onDropViewInstance(view)
    }
}
