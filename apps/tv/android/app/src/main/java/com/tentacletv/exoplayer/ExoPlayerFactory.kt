package com.tentacletv.exoplayer

import android.content.Context
import android.media.AudioFormat
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.RenderersFactory
import androidx.media3.exoplayer.audio.AudioCapabilities
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.text.TextOutput
import androidx.media3.exoplayer.text.TextRenderer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.exoplayer.video.VideoRendererEventListener

/**
 * La construction du lecteur ExoPlayer — renderers, source, sélecteur de pistes,
 * contrôle de tampon — sortie de la vue (`ExoPlayerView`), qui ne garde que le
 * cycle de vie. Extraction sans changement de comportement.
 */
@UnstableApi
object ExoPlayerFactory {
    private const val TAG = "ExoPlayerView"

    /** Attributs audio du lecteur : un film, pas une notification. */
    val mediaAudioAttributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
        .build()

    /** Capacités audio réelles (HDMI / ampli) en passthrough, sinon PCM stéréo. */
    fun audioCapabilitiesFor(context: Context, passthrough: Boolean): AudioCapabilities =
        if (passthrough) AudioCapabilities.getCapabilities(context)
        else AudioCapabilities.DEFAULT_AUDIO_CAPABILITIES

    /**
     * Renderers : mode extension ON (décodeur FFmpeg de Jellyfin en repli),
     * `DvCompatRenderer` en tête des renderers vidéo (Dolby Vision 7 → 8.1),
     * décodage legacy des sous-titres texte (SSA/ASS décodés par le TextRenderer).
     */
    fun createRenderersFactory(context: Context, passthrough: Boolean): RenderersFactory {
        val audioCapabilities = audioCapabilitiesFor(context, passthrough)
        return object : DefaultRenderersFactory(context) {
            init {
                setExtensionRendererMode(EXTENSION_RENDERER_MODE_ON)
                setEnableDecoderFallback(true)
            }

            override fun buildAudioSink(
                context: Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean,
            ): AudioSink {
                return DefaultAudioSink.Builder(context)
                    .setAudioCapabilities(audioCapabilities)
                    .setEnableFloatOutput(enableFloatOutput)
                    .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                    .build()
            }

            override fun buildVideoRenderers(
                context: Context,
                extensionRendererMode: Int,
                mediaCodecSelector: MediaCodecSelector,
                enableDecoderFallback: Boolean,
                eventHandler: Handler,
                eventListener: VideoRendererEventListener,
                allowedVideoJoiningTimeMs: Long,
                out: ArrayList<Renderer>,
            ) {
                out.add(DvCompatRenderer(
                    context, mediaCodecSelector, enableDecoderFallback,
                    eventHandler, eventListener, allowedVideoJoiningTimeMs,
                ))
                super.buildVideoRenderers(
                    context, extensionRendererMode, mediaCodecSelector,
                    enableDecoderFallback, eventHandler, eventListener,
                    allowedVideoJoiningTimeMs, out,
                )
            }

            // Décodage legacy forcé : le TextRenderer décode lui-même SSA/ASS au
            // lieu de compter sur l'analyse à l'extraction (onCues cassé en 1.8).
            override fun buildTextRenderers(
                context: Context,
                output: TextOutput,
                outputLooper: Looper,
                extensionRendererMode: Int,
                out: ArrayList<Renderer>,
            ) {
                super.buildTextRenderers(context, output, outputLooper, extensionRendererMode, out)
                for (renderer in out) {
                    if (renderer is TextRenderer) {
                        renderer.experimentalSetLegacyDecodingEnabled(true)
                        Log.w(TAG, ">>> TextRenderer legacy decoding ENABLED")
                    }
                }
            }
        }
    }

    /** Pas d'analyse des sous-titres à l'extraction (va avec le décodage legacy). */
    fun createMediaSourceFactory(context: Context): MediaSource.Factory =
        DefaultMediaSourceFactory(context).experimentalParseSubtitlesDuringExtraction(false)

    /**
     * Codecs audio à préférer, parmi ceux que la sortie sait recevoir en
     * passthrough — dans cet ordre de préférence. Une liste inconditionnelle
     * ferait préférer un TrueHD décodé en logiciel (décodeur FFmpeg) à un E-AC3
     * en passthrough : `preferredMimeTypeMatchIndex` passe avant
     * `usesHardwareAcceleration` dans le sélecteur.
     */
    fun preferredAudioMimeTypes(context: Context, passthrough: Boolean): List<String> {
        if (!passthrough) return emptyList()
        val caps = AudioCapabilities.getCapabilities(context)
        val candidates = linkedMapOf(
            MimeTypes.AUDIO_TRUEHD to AudioFormat.ENCODING_DOLBY_TRUEHD,
            MimeTypes.AUDIO_DTS_HD to AudioFormat.ENCODING_DTS_HD,
            MimeTypes.AUDIO_E_AC3 to AudioFormat.ENCODING_E_AC3,
            MimeTypes.AUDIO_AC3 to AudioFormat.ENCODING_AC3,
            MimeTypes.AUDIO_DTS to AudioFormat.ENCODING_DTS,
        )
        val preferred = candidates.filter { (_, encoding) -> caps.supportsEncoding(encoding) }.keys.toList()
        Log.w(TAG, ">>> Audio passthrough: $preferred")
        return preferred
    }

    /**
     * Sélecteur de pistes : langue audio non contrainte, codecs passthrough
     * préférés, sous-titres désactivés au départ (subtitleIndex = -1 côté JS —
     * la sélection se fait ensuite explicitement via setSubtitleTrack).
     */
    fun createTrackSelector(context: Context, preferredMimeTypes: List<String>, tunneling: Boolean): DefaultTrackSelector =
        DefaultTrackSelector(context).apply {
            parameters = buildUponParameters()
                .setPreferredAudioLanguage("und")
                .setPreferredAudioMimeTypes(*preferredMimeTypes.toTypedArray())
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                .setTunnelingEnabled(tunneling)
                .build()
        }

    /** Tampon : 50 s minimum, 300 s maximum, 2,5 s pour démarrer, 5 s après un re-buffer. */
    fun createLoadControl(): LoadControl =
        DefaultLoadControl.Builder()
            .setBufferDurationsMs(50_000, 300_000, 2_500, 5_000)
            .build()
}
