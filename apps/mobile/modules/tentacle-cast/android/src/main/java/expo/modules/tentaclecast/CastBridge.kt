// Tentacle TV — AGPL-3.0-or-later (lié aux Google Play services par LICENSE-EXCEPTIONS §2).
package expo.modules.tentaclecast

import android.content.Context
import android.net.Uri
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaSeekOptions
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.MediaTrack
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.CastState
import com.google.android.gms.cast.framework.CastStateListener
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.images.WebImage

/** Ce que JS demande de lire (`src/TentacleCast.ts` → `CastLoadRequest`). */
data class CastLoad(
  val url: String,
  val contentType: String,
  val title: String,
  val subtitle: String?,
  val imageUrl: String?,
  val startSeconds: Double,
  val durationSeconds: Double,
  val textTrackUrl: String?,
  val textTrackLanguage: String?,
  val textTrackName: String?,
)

/**
 * Le pont entre JS et Google Cast : état des appareils, session, média du
 * récepteur. Tout se fait sur le fil principal (exigence du SDK). Aucune
 * décision ici — le profil, l'URL, la position viennent de la règle JS.
 */
class CastBridge(
  private val emitState: (Map<String, Any?>) -> Unit,
  private val emitStatus: (Map<String, Any?>) -> Unit,
) {
  private var context: CastContext? = null

  private val stateListener = CastStateListener { emitState(stateMap()) }

  private val mediaCallback = object : RemoteMediaClient.Callback() {
    override fun onStatusUpdated() = emitStatus(statusMap())
  }

  private val progressListener = RemoteMediaClient.ProgressListener { _, _ -> emitStatus(statusMap()) }

  private val sessionListener = object : SessionManagerListener<CastSession> {
    override fun onSessionStarted(session: CastSession, sessionId: String) = watch(session)
    override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) = watch(session)
    override fun onSessionEnded(session: CastSession, error: Int) = emitState(stateMap())
    override fun onSessionStarting(session: CastSession) = emitState(stateMap())
    override fun onSessionStartFailed(session: CastSession, error: Int) = emitState(stateMap())
    override fun onSessionEnding(session: CastSession) {}
    override fun onSessionResuming(session: CastSession, sessionId: String) {}
    override fun onSessionResumeFailed(session: CastSession, error: Int) = emitState(stateMap())
    override fun onSessionSuspended(session: CastSession, reason: Int) = emitState(stateMap())
  }

  /** Sans les Google Play services (téléphone « dégooglisé »), pas de Cast : jamais une erreur. */
  fun start(appContext: Context?): Boolean {
    if (context != null) return true
    val ctx = appContext ?: return false
    if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) != ConnectionResult.SUCCESS) return false
    val cast = try {
      @Suppress("DEPRECATION")
      CastContext.getSharedInstance(ctx)
    } catch (e: Exception) {
      return false
    }
    context = cast
    cast.addCastStateListener(stateListener)
    cast.sessionManager.addSessionManagerListener(sessionListener, CastSession::class.java)
    cast.sessionManager.currentCastSession?.let { watch(it) }
    return true
  }

  fun stop() {
    context?.removeCastStateListener(stateListener)
    context?.sessionManager?.removeSessionManagerListener(sessionListener, CastSession::class.java)
    client()?.let { it.unregisterCallback(mediaCallback); it.removeProgressListener(progressListener) }
    context = null
  }

  fun mergedSelector() = context?.mergedSelector

  fun isConnected(): Boolean = context?.sessionManager?.currentCastSession?.isConnected == true

  fun stateMap(): Map<String, Any?> {
    val cast = context ?: return mapOf("state" to "unavailable", "deviceName" to null)
    val state = when (cast.castState) {
      CastState.NO_DEVICES_AVAILABLE -> "noDevices"
      CastState.NOT_CONNECTED -> "notConnected"
      CastState.CONNECTING -> "connecting"
      CastState.CONNECTED -> "connected"
      else -> "unavailable"
    }
    return mapOf("state" to state, "deviceName" to cast.sessionManager.currentCastSession?.castDevice?.friendlyName)
  }

  fun statusMap(): Map<String, Any?> {
    val client = client() ?: return mapOf("playerState" to "idle", "idleReason" to null, "position" to 0.0, "duration" to 0.0, "contentId" to null)
    val status = client.mediaStatus
    val playerState = when (status?.playerState) {
      MediaStatus.PLAYER_STATE_PLAYING -> "playing"
      MediaStatus.PLAYER_STATE_PAUSED -> "paused"
      MediaStatus.PLAYER_STATE_BUFFERING -> "buffering"
      MediaStatus.PLAYER_STATE_LOADING -> "loading"
      else -> "idle"
    }
    val idleReason = when (status?.idleReason) {
      MediaStatus.IDLE_REASON_FINISHED -> "finished"
      MediaStatus.IDLE_REASON_CANCELED -> "cancelled"
      MediaStatus.IDLE_REASON_INTERRUPTED -> "interrupted"
      MediaStatus.IDLE_REASON_ERROR -> "error"
      else -> null
    }
    return mapOf(
      "playerState" to playerState,
      "idleReason" to idleReason,
      "position" to client.approximateStreamPosition / 1000.0,
      "duration" to client.streamDuration / 1000.0,
      "contentId" to client.mediaInfo?.contentId,
    )
  }

  fun load(request: CastLoad): Boolean {
    val client = client() ?: return false
    val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE).apply {
      putString(MediaMetadata.KEY_TITLE, request.title)
      request.subtitle?.let { putString(MediaMetadata.KEY_SUBTITLE, it) }
      request.imageUrl?.let { addImage(WebImage(Uri.parse(it))) }
    }
    val track = request.textTrackUrl?.let {
      MediaTrack.Builder(TEXT_TRACK_ID, MediaTrack.TYPE_TEXT)
        .setSubtype(MediaTrack.SUBTYPE_SUBTITLES)
        .setContentId(it)
        .setContentType("text/vtt")
        .setLanguage(request.textTrackLanguage)
        .setName(request.textTrackName)
        .build()
    }
    val info = MediaInfo.Builder(request.url)
      .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
      .setContentType(request.contentType)
      .setMetadata(metadata)
      .apply { if (request.durationSeconds > 0) setStreamDuration((request.durationSeconds * 1000).toLong()) }
      .apply { if (track != null) setMediaTracks(listOf(track)) }
      .build()
    val load = MediaLoadRequestData.Builder()
      .setMediaInfo(info)
      .setAutoplay(true)
      .setCurrentTime((request.startSeconds * 1000).toLong().coerceAtLeast(0))
      .apply { if (track != null) setActiveTrackIds(longArrayOf(TEXT_TRACK_ID)) }
      .build()
    client.load(load)
    return true
  }

  fun play() { client()?.play() }
  fun pause() { client()?.pause() }
  fun seek(seconds: Double) {
    client()?.seek(MediaSeekOptions.Builder().setPosition((seconds * 1000).toLong().coerceAtLeast(0)).build())
  }

  /** Arrêter la diffusion : le média du récepteur, puis la session (la TV revient à son écran). */
  fun endSession() {
    context?.sessionManager?.endCurrentSession(true)
  }

  private fun client(): RemoteMediaClient? = context?.sessionManager?.currentCastSession?.remoteMediaClient

  private fun watch(session: CastSession) {
    session.remoteMediaClient?.let {
      it.unregisterCallback(mediaCallback)
      it.removeProgressListener(progressListener)
      it.registerCallback(mediaCallback)
      it.addProgressListener(progressListener, PROGRESS_INTERVAL_MS)
    }
    emitState(stateMap())
  }

  companion object {
    private const val TEXT_TRACK_ID = 1L
    private const val PROGRESS_INTERVAL_MS = 1000L
  }
}
