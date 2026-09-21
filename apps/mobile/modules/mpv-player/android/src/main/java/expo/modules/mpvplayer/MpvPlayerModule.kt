// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MpvPlayerModule.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/).
package expo.modules.mpvplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Le module Expo « MpvPlayer » sur Android : mêmes props, fonctions et événements qu'iOS. */
class MpvPlayerModule : Module() {
    private var logListener: ((String, String) -> Unit)? = null

    override fun definition() = ModuleDefinition {
        Name("MpvPlayer")

        Events("onNativeLog")

        // Le journal natif ne traverse le pont que si JS écoute.
        OnStartObserving {
            if (logListener != null) return@OnStartObserving
            val listener: (String, String) -> Unit = { message, type ->
                sendEvent("onNativeLog", mapOf("message" to message, "type" to type))
            }
            logListener = listener
            MpvLogger.addListener(listener)
        }

        OnStopObserving {
            logListener?.let { MpvLogger.removeListener(it) }
            logListener = null
        }

        // Sans AirPlay sur Android : jamais actif.
        Function("isAirPlayRouteActive") { false }
        // AV1 : dav1d en logiciel, ou MediaCodec quand la puce le décode — mpv choisit (`hwdec-codecs`).
        Function("supportsAv1HardwareDecode") { false }
        Function("isSimulator") { isEmulator() }

        View(MpvPlayerView::class) {
            Events(
                "onLoad", "onProgress", "onBuffering", "onEnd", "onError", "onTracksChanged",
                "onVideoParams", "onPipChanged", "onPlaybackStateChange", "onAirPlayRoute",
            )

            Prop("source") { view: MpvPlayerView, source: Map<String, Any?>? ->
                val config = source?.let { MpvLoadConfig.parse(it) } ?: return@Prop
                view.load(config)
            }
            Prop("paused") { view: MpvPlayerView, paused: Boolean -> view.setPaused(paused) }
            Prop("speed") { view: MpvPlayerView, speed: Double -> view.renderer.setSpeed(if (speed > 0) speed else 1.0) }
            Prop("nowPlaying") { _: MpvPlayerView, _: Map<String, Any?>? ->
                // Les commandes média Android passent par une MediaSession : hors du périmètre de cette version.
            }
            Prop("subtitleScale") { view: MpvPlayerView, scale: Double -> view.renderer.setSubtitleScale(if (scale > 0) scale else 1.0) }
            Prop("subtitlePosition") { view: MpvPlayerView, position: Int -> view.renderer.setSubtitlePosition(position.coerceIn(0, 150)) }
            Prop("subtitleDelay") { view: MpvPlayerView, seconds: Double -> view.renderer.setSubtitleDelay(seconds) }
            Prop("audioDelay") { view: MpvPlayerView, seconds: Double -> view.renderer.setAudioDelay(seconds) }
            Prop("pipAutoStart") { view: MpvPlayerView, enabled: Boolean -> view.pipAutoStart = enabled }

            AsyncFunction("seekTo") { view: MpvPlayerView, seconds: Double -> view.seekTo(seconds) }
            AsyncFunction("getPosition") { view: MpvPlayerView -> view.getPosition() }
            AsyncFunction("setAudioTrack") { view: MpvPlayerView, id: Int -> view.renderer.setAudioTrack(id) }
            AsyncFunction("setSubtitleTrack") { view: MpvPlayerView, id: Int -> view.renderer.setSubtitleTrack(id) }
            AsyncFunction("addSubtitle") { view: MpvPlayerView, url: String, select: Boolean -> view.renderer.addSubtitle(url, select) }
            AsyncFunction("getTracks") { view: MpvPlayerView -> view.renderer.getTracks() }
            AsyncFunction("getTechnicalInfo") { view: MpvPlayerView -> view.renderer.getTechnicalInfo() }
            AsyncFunction("startPictureInPicture") { view: MpvPlayerView -> view.startPictureInPicture() }
            AsyncFunction("stopPictureInPicture") { view: MpvPlayerView -> view.stopPictureInPicture() }
            AsyncFunction("isPictureInPictureSupported") { view: MpvPlayerView -> view.isPictureInPictureSupported() }
            AsyncFunction("isPictureInPictureActive") { view: MpvPlayerView -> view.isPictureInPictureActive() }
            AsyncFunction("stop") { view: MpvPlayerView -> view.stop() }

            // Le démontage se fait ici, à la destruction par React Native — pas
            // à `onDetachedFromWindow`, qu'un rattachement sans destruction
            // (transition d'écran) rendrait définitif.
            OnViewDestroys { view: MpvPlayerView -> view.destroy() }
        }
    }
}
