package expo.modules.octaveaudio

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import org.json.JSONObject

/**
 * Le moteur d'Octave, UN par processus, partagé par le module Expo (le pont) et
 * le service de la session média (`OctaveAudioService`) : il survit à un
 * rechargement du JS et à l'application quittée tant que la musique joue.
 *
 * Il lit les commandes du pont (`invoke`), les confie aux platines
 * (`PlaybackCore`), renvoie les évènements au JS (`emit`), et tient la session
 * média : le service démarre au premier `audio_engine_start` / `audio_play`,
 * s'arrête à `audio_engine_stop`. Fil principal seulement.
 */
@OptIn(UnstableApi::class)
internal object OctaveAudioEngine : PlaybackCore.Host {
    private const val TAG = "OctaveAudio"
    private const val SESSION_ID = "octave-audio"

    private var appContext: Context? = null
    private var emitter: ((String) -> Unit)? = null
    private var emitterOwner: Any? = null
    private var core: PlaybackCore? = null
    private var started = false

    /** La session média (une par processus), tant que le service tourne. */
    var session: MediaSession? = null
        private set
    private var service: OctaveAudioService? = null
    private var serviceRequested = false

    // ── Le pont ─────────────────────────────────────────────────────────────

    /** Le JS écoute (`onBridgeEvent`) : un seul module à la fois, le plus récent (rechargement du JS). */
    fun setEmitter(owner: Any, emit: (String) -> Unit) {
        emitterOwner = owner
        emitter = emit
    }

    fun clearEmitter(owner: Any) {
        if (emitterOwner !== owner) return
        emitterOwner = null
        emitter = null
    }

    /** Une commande du pont (`AUDIO_BRIDGE_COMMANDS`) : la réponse en JSON, `""` pour rien. */
    fun invoke(context: Context, command: String, argsJson: String): String {
        appContext = context.applicationContext
        val args = BridgeJson.parse(argsJson)
        return when (command) {
            "audio_engine_start" -> start(BridgeJson.start(args))
            "audio_engine_stop" -> stop().let { "" }
            "audio_play" -> play(args).let { "" }
            "audio_set_next" -> core().setNext(entryOf(args), args.longOrNull("crossfadeMs") ?: 0).let { "" }
            "audio_swap_source" -> swapSource(args).let { "" }
            "audio_control" -> control(args).let { "" }
            "audio_list_outputs" -> BridgeJson.outputs()
            // Une seule sortie sur Android : celle que choisit le système (haut-parleur, casque, Bluetooth).
            "audio_set_output" -> ""
            "audio_level" -> "null"
            else -> throw IllegalArgumentException("octave-audio: commande inconnue « $command »")
        }
    }

    private fun core(): PlaybackCore {
        core?.let { return it }
        val context = appContext ?: throw IllegalStateException("octave-audio: contexte Android absent")
        return PlaybackCore(context, this).also { core = it }
    }

    /** Idempotent : un second départ réutilise l'instance (nouvelle origine, nouveaux en-têtes, réglages). */
    private fun start(s: BridgeStart): String {
        SourcePolicy.configure(s.serverOrigin, s.headers)
        core().configure(s.volume, s.muted, s.replayGain)
        started = true
        ensureService()
        return BridgeJson.capabilities()
    }

    private fun stop() {
        started = false
        stopService()
        core?.release()
        core = null
        SourcePolicy.clear()
    }

    private fun play(args: JSONObject) {
        val entry = entryOf(args) ?: throw IllegalArgumentException("audio_play: titre ou source illisible")
        core().play(entry, args.longOrNull("startMs") ?: 0)
    }

    private fun swapSource(args: JSONObject) {
        val trackKey = args.stringOrNull("trackKey") ?: return
        val source = BridgeJson.source(args.optJSONObject("source")) ?: return
        if (core?.swap(trackKey, source) == true) emit(BridgeJson.swappedEvent(trackKey, source.origin))
    }

    private fun control(args: JSONObject) {
        val core = core()
        when (args.stringOrNull("action")) {
            "pause" -> core.pause()
            "resume" -> core.resume()
            "stop" -> core.stop()
            "seek" -> core.seek(args.longOrNull("value") ?: 0)
            "volume" -> core.setVolume(args.doubleOrNull("value") ?: 1.0)
            "muted" -> core.setMuted(args.optBoolean("value", false))
            "replayGain" -> core.setReplayGain(args.stringOrNull("mode") ?: "off")
            // Le réglage, pour information : la durée de CHAQUE fondu arrive avec `audio_set_next`.
            "crossfade" -> Unit
            else -> Log.w(TAG, "audio_control : action inconnue")
        }
    }

    private fun entryOf(args: JSONObject): DeckEntry? {
        val track = BridgeJson.track(args.optJSONObject("track")) ?: return null
        val source = BridgeJson.source(args.optJSONObject("source")) ?: return null
        return DeckEntry(track, source)
    }

    // ── PlaybackCore.Host ───────────────────────────────────────────────────

    override fun emit(json: String) {
        emitter?.invoke(json)
    }

    override fun onFrontChanged(player: Player) {
        val current = session ?: return
        if ((current.player as? SessionPlayer)?.wrappedPlayer === player) return
        current.player = SessionPlayer(player, core().remote)
    }

    override fun onPlaybackRequested() = ensureService()

    // ── Le service de la session média ──────────────────────────────────────

    /** Vrai si la musique joue (le service ne s'arrête pas quand l'application est balayée). */
    fun isPlaying(): Boolean = core?.isPlaying() == true

    /**
     * L'application est balayée et rien ne joue : platines, focus et service libérés — mais le moteur reste
     * DÉMARRÉ (origine, en-têtes, réglages). Le JS peut survivre au balayage (l'hôte React Native est à
     * l'application, pas à l'activité) : il apprend par l'état « idle » que le titre est perdu, et sa
     * « Lecture » suivante le rejoue à sa position. Arrêté comme `audio_engine_stop`, il refusait ensuite
     * toute source (origine oubliée) sans que le JS le sache : la musique ne repartait plus.
     */
    fun releaseIdle() {
        stopService()
        core?.let {
            it.release()
            it.queueState()
        }
    }

    private fun ensureService() {
        if (service != null || serviceRequested) return
        val context = appContext ?: return
        try {
            context.startService(Intent(context, OctaveAudioService::class.java))
            serviceRequested = true
        } catch (error: IllegalStateException) {
            // Démarrage refusé en arrière-plan (Android 8+) : nouvel essai à la prochaine lecture.
            Log.w(TAG, "service média non démarré", error)
        }
    }

    fun onServiceCreated(created: OctaveAudioService) {
        serviceRequested = false
        if (!started && !isPlaying()) {
            // Le moteur s'est arrêté avant que le service naisse (ou le système le relance seul).
            created.stopSelf()
            return
        }
        service = created
        val core = core()
        val current = session ?: MediaSession.Builder(created, SessionPlayer(core.front.player, core.remote))
            .setId(SESSION_ID)
            .also { builder -> launchIntent(created)?.let { builder.setSessionActivity(it) } }
            .build()
            .also { session = it }
        created.addSession(current)
    }

    fun onServiceDestroyed(destroyed: OctaveAudioService) {
        if (service !== destroyed) return
        releaseSession()
        service = null
    }

    private fun stopService() {
        releaseSession()
        val running = service
        service = null
        serviceRequested = false
        if (running != null) {
            running.stopSelf()
        } else {
            appContext?.let { it.stopService(Intent(it, OctaveAudioService::class.java)) }
        }
    }

    private fun releaseSession() {
        val current = session ?: return
        session = null
        service?.removeSession(current)
        current.release()
    }

    /** Toucher la notification rouvre l'application. */
    private fun launchIntent(context: Context): PendingIntent? {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
}
