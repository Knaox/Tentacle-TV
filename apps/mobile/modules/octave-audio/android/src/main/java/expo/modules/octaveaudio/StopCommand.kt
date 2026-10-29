package expo.modules.octaveaudio

import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.util.Locale

/**
 * « Arrêter » dans la notification média (et les contrôleurs qui montrent les boutons de la session : écran
 * verrouillé, montre) : une commande de session à part — la lecture s'arrête, la notification part, et le JS
 * vide sa file (`remote: stop`). Le « stop » du lecteur, lui, reste une pause (casque, montre : `SessionPlayer`).
 */
@OptIn(UnstableApi::class)
internal object StopCommand {
    private const val ACTION = "expo.modules.octaveaudio.STOP"

    private val command = SessionCommand(ACTION, Bundle.EMPTY)

    /** Le bouton, libellé dans la langue de l'appareil (le module n'a pas de ressources traduites). */
    fun button(): CommandButton = CommandButton.Builder(CommandButton.ICON_STOP)
        .setDisplayName(if (Locale.getDefault().language == "fr") "Arrêter la lecture" else "Stop playback")
        .setSessionCommand(command)
        .build()

    /** Les contrôleurs (notification comprise) ont le droit d'envoyer la commande ; le reste comme par défaut. */
    fun callback(onStop: () -> Unit): MediaSession.Callback = object : MediaSession.Callback {
        override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult =
            MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().add(command).build())
                .build()

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle,
        ): ListenableFuture<SessionResult> {
            if (customCommand.customAction != ACTION) return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
            onStop()
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
    }
}
