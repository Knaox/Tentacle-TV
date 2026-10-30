package expo.modules.octaveaudio

import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Le NIVEAU du son d'une platine (`audio_level` du pont : dBFS, comme le filtre `astats` du bureau), pour la
 * vague du lecteur plein écran. Un `TeeAudioProcessor` de Media3 lui passe chaque tampon PCM décodé, SANS le
 * modifier (aucune permission : ce n'est pas le Visualizer, qui exige le micro) ; il en garde le niveau RMS, daté.
 *
 * Le tampon passe ici AVANT d'être entendu (la sortie audio garde de l'avance) : la mesure rendue est celle d'il
 * y a `OUTPUT_LEAD_MS`, pour que la vague tombe avec le son. Le tampon est lu sur le fil de lecture, la mesure sur
 * le fil principal : un petit anneau sous verrou.
 */
@OptIn(UnstableApi::class)
internal class LevelMeter : TeeAudioProcessor.AudioBufferSink {
    private val lock = Any()
    private val times = LongArray(RING)
    private val levels = DoubleArray(RING)
    private var next = 0
    private var count = 0

    @Volatile
    private var encoding = C.ENCODING_INVALID

    override fun flush(sampleRateHz: Int, channelCount: Int, encoding: Int) {
        this.encoding = encoding
        synchronized(lock) { count = 0 }
    }

    override fun handleBuffer(buffer: ByteBuffer) {
        val rms = when (encoding) {
            C.ENCODING_PCM_16BIT -> rms16(buffer)
            C.ENCODING_PCM_FLOAT -> rmsFloat(buffer)
            else -> return
        } ?: return
        val db = if (rms <= 1e-6) SILENCE_DB else (20 * log10(rms)).coerceIn(SILENCE_DB, 0.0)
        synchronized(lock) {
            times[next] = SystemClock.elapsedRealtime()
            levels[next] = db
            next = (next + 1) % RING
            if (count < RING) count++
        }
    }

    /** Le niveau entendu maintenant (dBFS), ou `null` : rien de mesuré récemment (pause, attente, autre format). */
    fun level(): Double? {
        val target = SystemClock.elapsedRealtime() - OUTPUT_LEAD_MS
        synchronized(lock) {
            if (count == 0) return null
            var best: Double? = null
            var bestGap = Long.MAX_VALUE
            for (i in 0 until count) {
                val index = (next - 1 - i + RING) % RING
                val gap = kotlin.math.abs(times[index] - target)
                if (gap < bestGap) {
                    bestGap = gap
                    best = levels[index]
                }
            }
            return if (bestGap <= STALE_MS) best else null
        }
    }

    /** La réponse du pont : un nombre, ou `null`. */
    fun levelJson(): String = level()?.let { String.format(java.util.Locale.ROOT, "%.2f", it) } ?: "null"

    private fun rms16(buffer: ByteBuffer): Double? {
        val view = buffer.duplicate().order(ByteOrder.nativeOrder()).asShortBuffer()
        val n = view.remaining()
        if (n == 0) return null
        var sum = 0.0
        var used = 0
        // Un échantillon sur `STRIDE` suffit au niveau d'un tampon (le coût reste négligeable sur le fil de lecture).
        var i = 0
        while (i < n) {
            val s = view.get(i) / 32768.0
            sum += s * s
            used++
            i += STRIDE
        }
        return sqrt(sum / used)
    }

    private fun rmsFloat(buffer: ByteBuffer): Double? {
        val view = buffer.duplicate().order(ByteOrder.nativeOrder()).asFloatBuffer()
        val n = view.remaining()
        if (n == 0) return null
        var sum = 0.0
        var used = 0
        var i = 0
        while (i < n) {
            val s = view.get(i).toDouble()
            sum += s * s
            used++
            i += STRIDE
        }
        return sqrt(sum / used)
    }

    private companion object {
        const val RING = 64
        const val STRIDE = 4
        /** L'avance de la sortie sur ce qu'on entend (ordre de grandeur du tampon d'AudioTrack de Media3). */
        const val OUTPUT_LEAD_MS = 200L
        /** Au-delà, la mesure ne dit plus le son de maintenant. */
        const val STALE_MS = 400L
        const val SILENCE_DB = -120.0
    }
}
