package expo.modules.octaveaudio

import androidx.annotation.OptIn
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi

/** Ce que la session média reçoit du SYSTÈME (notification, écran verrouillé, casque, montre). */
internal interface SessionCommandSink {
    fun onSessionPlay()
    fun onSessionPause()
    fun onSessionSeek(positionMs: Long)
    fun onSessionSkip(forward: Boolean)
}

/**
 * Le lecteur que voit la session média : la platine DEVANT, vue à travers ce
 * filtre (re-posé par `session.player = …` quand la platine devant change).
 *
 * - Précédent / suivant TOUJOURS proposés (la file est en JS, la platine n'en sait
 *   rien) et seulement TRANSMIS : `remote: next|previous`, rien d'autre.
 * - Lecture / pause : appliquées aux DEUX platines tout de suite (un fondu en
 *   cours suit), puis transmises (`remote: play|pause`) — c'est le moteur qui le fait.
 * - Position (barre de l'écran verrouillé) : appliquée par le moteur.
 *
 * Les commandes ajoutées doivent aussi passer par `onAvailableCommandsChanged` :
 * la session relaie aux contrôleurs les commandes que la PLATINE annonce, pas
 * `getAvailableCommands()` de ce filtre — d'où l'écouteur réécrit (`SkipCommandsListener`).
 */
@OptIn(UnstableApi::class)
internal class SessionPlayer(player: Player, private val sink: SessionCommandSink) : ForwardingPlayer(player) {
    override fun getAvailableCommands(): Player.Commands = withSkips(super.getAvailableCommands())

    override fun isCommandAvailable(command: Int): Boolean = command in SKIP_COMMANDS || super.isCommandAvailable(command)

    override fun seekToNext() = sink.onSessionSkip(forward = true)

    override fun seekToNextMediaItem() = sink.onSessionSkip(forward = true)

    override fun seekToPrevious() = sink.onSessionSkip(forward = false)

    override fun seekToPreviousMediaItem() = sink.onSessionSkip(forward = false)

    override fun play() = sink.onSessionPlay()

    override fun pause() = sink.onSessionPause()

    override fun setPlayWhenReady(playWhenReady: Boolean) = if (playWhenReady) sink.onSessionPlay() else sink.onSessionPause()

    /** « Arrêter » d'un casque ou d'une montre : une pause, la file reste au JS. */
    override fun stop() = sink.onSessionPause()

    override fun seekTo(positionMs: Long) = sink.onSessionSeek(positionMs)

    override fun seekTo(mediaItemIndex: Int, positionMs: Long) {
        // Un autre titre de la file de la platine (le suivant préchargé) : la file est au JS, on ne saute pas.
        if (mediaItemIndex == currentMediaItemIndex) sink.onSessionSeek(positionMs)
    }

    override fun addListener(listener: Player.Listener) = super.addListener(SkipCommandsListener(listener) { withSkips(it) })

    override fun removeListener(listener: Player.Listener) = super.removeListener(SkipCommandsListener(listener) { withSkips(it) })

    private companion object {
        val SKIP_COMMANDS = intArrayOf(
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
        )

        fun withSkips(commands: Player.Commands): Player.Commands = commands.buildUpon().addAll(*SKIP_COMMANDS).build()
    }
}
