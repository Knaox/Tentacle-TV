package expo.modules.octaveaudio

/**
 * Le RYTHME des états vers le JS (lot « bat », 08/11) : chaque état réveille le JS. L'horloge
 * (`PlaybackCore.tick`) ne tourne déjà qu'en lecture ; application derrière, elle garde sa précision
 * (fondus, signal de départ) mais la position ne part plus qu'au plus toutes les 5 s — un changement d'état
 * (`queueState`) part toujours aussitôt, et le retour au premier plan envoie l'état tout de suite. La
 * notification et l'écran verrouillé lisent la position dans la session média : ils n'en dépendent pas.
 * Fil principal seulement.
 */
internal object StatePace {
    /** Un état toutes les 250 ms en lecture, application devant (marge pour la gigue de l'horloge). */
    private const val FOREGROUND_MS = 240L

    /** Application derrière : rien ne montre la position, les rapports d'écoute s'en contentent. */
    private const val BACKGROUND_MS = 5_000L

    /** L'activité de l'application est en pause (derrière, écran éteint) : posé par le module. */
    var inBackground = false

    fun everyMs(): Long = if (inBackground) BACKGROUND_MS else FOREGROUND_MS
}
