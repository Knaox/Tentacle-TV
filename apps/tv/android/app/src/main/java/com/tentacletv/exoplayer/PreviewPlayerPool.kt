package com.tentacletv.exoplayer

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import java.lang.ref.WeakReference

/**
 * UN lecteur ExoPlayer pour tous les aperçus de l'appareil (Android TV) — un
 * seul aperçu joue à la fois (l'arbitre du JS). Le construire coûtait ~150 ms
 * de fil UI à l'émulateur à CHAQUE aperçu, au moment où le focus se pose sur
 * la carte suivante, et le relâcher bloquait aussi le fil UI (lot ba1016) :
 * désormais il passe d'une vue à l'autre (`acquire` le retire à la précédente,
 * `giveBack` l'arrête et le garde), et n'est relâché qu'au bout de
 * `IDLE_RELEASE_MS` sans aucun aperçu.
 */
@UnstableApi
internal object PreviewPlayerPool {
    private const val IDLE_RELEASE_MS = 60_000L

    private var player: ExoPlayer? = null
    private var owner: WeakReference<PreviewVideoView>? = null
    private val handler = Handler(Looper.getMainLooper())
    private val releaseIdle = Runnable {
        if (owner?.get() != null) return@Runnable
        player?.release()
        player = null
    }

    /** Le lecteur pour `view` : retiré à la vue qui l'avait, construit au premier aperçu. */
    fun acquire(view: PreviewVideoView, context: Context): ExoPlayer {
        handler.removeCallbacks(releaseIdle)
        val previous = owner?.get()
        if (previous != null && previous !== view) previous.onPlayerTaken()
        owner = WeakReference(view)
        return player ?: build(context.applicationContext).also { player = it }
    }

    /** `view` n'en veut plus : il s'arrête (décodeurs rendus) et attend l'aperçu suivant. */
    fun giveBack(view: PreviewVideoView) {
        if (owner?.get() !== view) return
        owner = null
        player?.let { exo ->
            exo.stop()
            exo.clearMediaItems()
        }
        handler.postDelayed(releaseIdle, IDLE_RELEASE_MS)
    }

    private fun build(context: Context): ExoPlayer =
        ExoPlayer.Builder(context)
            // Un aperçu : démarrer vite (1 s en tampon suffit), sans précharger toute la bande-annonce.
            .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(15_000, 30_000, 1_000, 2_000).build())
            .build()
            .also { exo -> exo.setAudioAttributes(ExoPlayerFactory.mediaAudioAttributes, false) }
}
