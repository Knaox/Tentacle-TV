package com.tentacletv.exoplayer

import androidx.media3.common.util.UnstableApi
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/** La vue `TentaclePreviewVideo` (`PreviewVideoView`) côté React Native : ses props et son canal d'évènements. */
@UnstableApi
class PreviewVideoViewManager : SimpleViewManager<PreviewVideoView>() {
    override fun getName(): String = NAME

    override fun createViewInstance(reactContext: ThemedReactContext): PreviewVideoView = PreviewVideoView(reactContext)

    /** `{ uri, hls, startMs }` : la source, chargée une fois toutes les props posées. */
    @ReactProp(name = "source")
    fun setSource(view: PreviewVideoView, source: ReadableMap?) {
        if (source == null) return
        val uri = if (source.hasKey("uri")) source.getString("uri") else null
        val hls = source.hasKey("hls") && source.getBoolean("hls")
        val startMs = if (source.hasKey("startMs")) source.getDouble("startMs").toLong() else 0L
        view.setSource(uri, hls, startMs)
    }

    @ReactProp(name = "paused", defaultBoolean = true)
    fun setPaused(view: PreviewVideoView, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "muted", defaultBoolean = false)
    fun setMuted(view: PreviewVideoView, muted: Boolean) {
        view.setMuted(muted)
    }

    @ReactProp(name = "volume", defaultFloat = 1f)
    fun setVolume(view: PreviewVideoView, volume: Float) {
        view.setVolume(volume)
    }

    @ReactProp(name = "progressInterval", defaultInt = 1000)
    fun setProgressInterval(view: PreviewVideoView, interval: Int) {
        view.progressIntervalMs = interval.toLong()
    }

    override fun onAfterUpdateTransaction(view: PreviewVideoView) {
        super.onAfterUpdateTransaction(view)
        view.commit()
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
        MapBuilder.of("onExoEvent", MapBuilder.of("registrationName", "onExoEvent"))

    override fun onDropViewInstance(view: PreviewVideoView) {
        view.release()
        super.onDropViewInstance(view)
    }

    companion object {
        const val NAME = "TentaclePreviewVideo"
    }
}
