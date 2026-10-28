package expo.modules.octaveaudio

import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Le service de la session média d'Octave (Media3) : la notification média par
 * défaut de Media3 (pochette, titre, artiste, album, lecture/pause,
 * précédent/suivant, barre), le service de premier plan pendant la lecture, et
 * les contrôleurs du système (écran verrouillé, casque, montre, Android Auto).
 *
 * Il ne possède rien : la session et les platines sont au moteur
 * (`OctaveAudioEngine`), qui le démarre et l'arrête.
 */
@OptIn(UnstableApi::class)
class OctaveAudioService : MediaSessionService() {
    override fun onCreate() {
        super.onCreate()
        OctaveAudioEngine.onServiceCreated(this)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = OctaveAudioEngine.session

    /** L'application balayée : on n'arrête que si rien ne joue (la musique continue sinon). */
    override fun onTaskRemoved(rootIntent: Intent?) {
        if (OctaveAudioEngine.isPlaying()) return
        OctaveAudioEngine.releaseIdle()
        stopSelf()
    }

    override fun onDestroy() {
        OctaveAudioEngine.onServiceDestroyed(this)
        super.onDestroy()
    }
}
