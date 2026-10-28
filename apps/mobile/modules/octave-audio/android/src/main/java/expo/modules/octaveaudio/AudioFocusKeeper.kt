package expo.modules.octaveaudio

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.util.Log

/**
 * Le focus audio, tenu À LA MAIN pour les deux platines (jamais par ExoPlayer :
 * deux lecteurs se le disputeraient), et la sortie débranchée.
 *
 * - Perte définitive (une autre application joue) : pause + `remote: pause`.
 * - Perte passagère (appel, alarme, assistant) : pause + `remote: pause` si l'on
 *   jouait, puis reprise + `remote: play` au retour du focus.
 * - Canard (« baisser le son », navigation GPS) : volume × 0,2 le temps de
 *   l'interruption. `setWillPauseWhenDucked(true)` : sans lui, Android 8+ baisse
 *   le son lui-même et ne prévient pas — c'est le moteur qui l'applique.
 * - `ACTION_AUDIO_BECOMING_NOISY` (casque débranché, Bluetooth coupé) : pause
 *   immédiate + `remote: pause`. Écouté tant que le focus est tenu.
 *
 * Fil principal (rappels sur `handler`).
 */
internal class AudioFocusKeeper(context: Context, private val handler: Handler, private val sink: Sink) {
    interface Sink {
        /** Le focus est perdu : mettre en pause ; vrai si l'on jouait (la reprise sera due au retour). */
        fun onFocusLoss(transient: Boolean): Boolean

        /** Le focus revient après une perte passagère pendant laquelle on jouait. */
        fun onFocusRegained()

        fun onDuck(ducked: Boolean)

        fun onBecomingNoisy()
    }

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var held = false
    private var resumeOnGain = false
    private var noisyRegistered = false

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change -> onFocusChange(change) }

    private val request: AudioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build(),
        )
        .setWillPauseWhenDucked(true)
        .setOnAudioFocusChangeListener(focusListener, handler)
        .build()

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                resumeOnGain = false
                sink.onBecomingNoisy()
            }
        }
    }

    /** Demande le focus avant de jouer. Faux : refusé (un appel en cours) — ne pas jouer. */
    fun acquire(): Boolean {
        resumeOnGain = false
        if (!held) {
            val result = audioManager.requestAudioFocus(request)
            held = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!held) {
                Log.w(TAG, "focus audio refusé ($result)")
                return false
            }
        }
        registerNoisy()
        return true
    }

    /** Une pause VOULUE : la fin d'une interruption ne relance plus rien. */
    fun cancelResume() {
        resumeOnGain = false
    }

    /** Rien ne jouera plus (arrêt, fin de la file) : le focus est rendu. */
    fun release() {
        resumeOnGain = false
        unregisterNoisy()
        if (held) {
            audioManager.abandonAudioFocusRequest(request)
            held = false
        }
        sink.onDuck(false)
    }

    private fun onFocusChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> {
                held = true
                sink.onDuck(false)
                if (resumeOnGain) {
                    resumeOnGain = false
                    sink.onFocusRegained()
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> sink.onDuck(true)
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (sink.onFocusLoss(transient = true)) resumeOnGain = true
            }
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Perdu pour de bon : aucun retour à attendre, le focus est rendu.
                sink.onFocusLoss(transient = false)
                release()
            }
        }
    }

    private fun registerNoisy() {
        if (noisyRegistered) return
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        // Diffusion du système : reçue même par un récepteur non exporté.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            appContext.registerReceiver(noisyReceiver, filter)
        }
        noisyRegistered = true
    }

    private fun unregisterNoisy() {
        if (!noisyRegistered) return
        noisyRegistered = false
        try {
            appContext.unregisterReceiver(noisyReceiver)
        } catch (error: IllegalArgumentException) {
            Log.w(TAG, "récepteur « sortie débranchée » déjà retiré", error)
        }
    }

    private companion object {
        const val TAG = "OctaveAudio"
    }
}
