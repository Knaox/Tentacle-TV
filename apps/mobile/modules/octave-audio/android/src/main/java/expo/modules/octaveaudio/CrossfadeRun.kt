package expo.modules.octaveaudio

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Le suivant prévu : `crossfadeMs` 0 → enchaînement SANS BLANC (dans la file de
 * la platine devant) ; > 0 → fondu de cette durée (sur l'autre platine, en pause à 0).
 */
internal class NextPlan(val entry: DeckEntry, val crossfadeMs: Long) {
    val fades: Boolean get() = crossfadeMs > 0
}

/**
 * Une transition douce en cours, entre deux platines. Les gains suivent des
 * courbes à PUISSANCE CONSTANTE : sortant = cos(x·π/2), entrant = sin(x·π/2).
 *
 * `x` = temps de LECTURE écoulé / durée, lu sur la position de l'ENTRANT (parti de
 * 0 au démarrage du fondu) : une pause des deux platines suspend le fondu, une
 * attente de données de l'entrant aussi — le sortant garde alors son gain.
 * Le moteur (`PlaybackCore`) fait avancer le fondu à son rythme (~30 ms) et en
 * tire la mi-fondu (`advanced`, l'entrant passe devant) et la fin (le sortant s'arrête).
 */
internal class CrossfadeRun(
    val outgoing: AudioDeck,
    val incoming: AudioDeck,
    /** La durée effective : celle demandée, ou ce qui restait du sortant s'il en restait moins. */
    val durationMs: Long,
    /** Le plan d'origine, pour le réarmer si le fondu est interrompu avant la mi-fondu (un déplacement). */
    val plan: NextPlan,
    val fromKey: String?,
) {
    var passedMid = false

    val toKey: String get() = plan.entry.trackKey

    /** L'avancement, de 0 à 1. */
    fun progress(): Double {
        if (durationMs <= 0) return 1.0
        return (incoming.player.currentPosition.toDouble() / durationMs).coerceIn(0.0, 1.0)
    }

    /** Pose les gains de la courbe pour l'avancement `x`. */
    fun applyCurve(x: Double) {
        outgoing.fadeGain = cos(x * PI / 2).toFloat().coerceIn(0f, 1f)
        incoming.fadeGain = sin(x * PI / 2).toFloat().coerceIn(0f, 1f)
    }

    companion object {
        /** Le pas d'horloge pendant un fondu ou à son approche. */
        const val FINE_TICK_MS = 30L

        /** Le pas d'horloge du reste de la lecture (le rythme des états). */
        const val COARSE_TICK_MS = 250L

        /** À moins de ce temps du signal de départ, l'horloge passe au pas fin. */
        const val APPROACH_MS = 1_000L

        /** Combien il reste avant le signal `durée − crossfadeMs` (négatif : il est passé), `null` sans durée connue. */
        fun msUntilStart(front: AudioDeck, plan: NextPlan): Long? {
            val duration = front.durationMs() ?: return null
            return duration - plan.crossfadeMs - front.player.currentPosition
        }
    }
}
