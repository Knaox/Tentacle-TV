package expo.modules.octaveaudio

/**
 * Ce que le SYSTÈME fait au moteur — focus audio (appel, alarme, autre
 * application, canard), sortie débranchée, et les commandes de la session média
 * (notification, écran verrouillé, casque, montre) — et ce que le JS en apprend
 * (`remote`). Lecture / pause : appliquées ici tout de suite (réactivité), puis
 * transmises — le JS tient l'intention « lecture ». Précédent / suivant :
 * transmis seulement (la file est en JS). La position : appliquée, l'état suit.
 */
internal class RemoteControls(private val core: PlaybackCore) : AudioFocusKeeper.Sink, SessionCommandSink {
    private fun send(command: String) = core.host.emit(BridgeJson.remoteEvent(command))

    override fun onFocusLoss(transient: Boolean): Boolean {
        if (!core.isPlaying()) return false
        core.pauseDecks()
        send("pause")
        core.queueState()
        return true
    }

    override fun onFocusRegained() {
        if (core.resume()) send("play")
    }

    override fun onDuck(ducked: Boolean) = core.setDucked(ducked)

    override fun onBecomingNoisy() {
        if (!core.isPlaying()) return
        core.pauseDecks()
        send("pause")
        core.queueState()
    }

    override fun onSessionPlay() {
        // Rien de chargé (après un arrêt) : la file est au JS, il décide.
        if (core.frontOrNull?.hasMedia != true) return send("play")
        if (core.resume()) send("play")
    }

    override fun onSessionPause() {
        core.pause()
        send("pause")
    }

    override fun onSessionSeek(positionMs: Long) = core.seek(positionMs)

    override fun onSessionSkip(forward: Boolean) = send(if (forward) "next" else "previous")
}
