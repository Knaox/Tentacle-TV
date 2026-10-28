package expo.modules.octaveaudio

import android.content.Context
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory

/**
 * La fabrique d'une platine : un ExoPlayer audio, sur le fil principal.
 *
 * - Décodeurs : ceux de la plateforme d'abord, puis les extensions FFmpeg de
 *   l'APK (`EXTENSION_RENDERER_MODE_ON` : l'ALAC là où MediaCodec ne le lit pas).
 * - Focus audio et « sortie débranchée » : JAMAIS par ExoPlayer — deux platines
 *   se disputeraient le focus. `AudioFocusKeeper` les tient pour le moteur.
 * - Sources : `ResolvingDataSource` (en-têtes sur l'origine du serveur seulement,
 *   refus du reste : `SourcePolicy`) devant `DefaultDataSource` (HTTP + `file://`).
 * - Tampon : de l'audio, donc modeste en octets ; assez de secondes pour passer
 *   un trou de réseau (métro) sans couper.
 */
@OptIn(UnstableApi::class)
internal object DeckPlayers {
    private const val MIN_BUFFER_MS = 30_000
    private const val MAX_BUFFER_MS = 120_000
    private const val BUFFER_FOR_PLAYBACK_MS = 1_000
    private const val BUFFER_AFTER_REBUFFER_MS = 2_500
    private const val TARGET_BUFFER_BYTES = 24 * 1024 * 1024
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 20_000
    private const val USER_AGENT = "TentacleTV-Octave/Android"

    fun create(context: Context): ExoPlayer {
        val renderers = DefaultRenderersFactory(context)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
            .setEnableDecoderFallback(true)
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(USER_AGENT)
            .setConnectTimeoutMs(CONNECT_TIMEOUT_MS)
            .setReadTimeoutMs(READ_TIMEOUT_MS)
            .setAllowCrossProtocolRedirects(false)
        val dataSource = ResolvingDataSource.Factory(DefaultDataSource.Factory(context, http), SourcePolicy.resolver)
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(MIN_BUFFER_MS, MAX_BUFFER_MS, BUFFER_FOR_PLAYBACK_MS, BUFFER_AFTER_REBUFFER_MS)
            .setTargetBufferBytes(TARGET_BUFFER_BYTES)
            .setPrioritizeTimeOverSizeThresholds(false)
            .build()
        val attributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()
        val player = ExoPlayer.Builder(context, renderers)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSource))
            .setLoadControl(loadControl)
            .setAudioAttributes(attributes, /* handleAudioFocus = */ false)
            .setHandleAudioBecomingNoisy(false)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setLooper(Looper.getMainLooper())
            .build()
        // De l'audio seul : une pochette vue comme piste vidéo, ou un sous-titre, ne réveille aucun décodeur.
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_VIDEO, true)
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
        return player
    }
}
