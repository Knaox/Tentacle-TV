// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLib.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/).
package expo.modules.mpvplayer

import android.content.Context
import dev.jdtech.mpv.MPVLib as LibMPV

/**
 * Enveloppe par instance de `dev.jdtech.mpv.MPVLib`.
 *
 * libmpv-android 1.0 expose une API par instance : chaque `LibMPV.create(ctx)`
 * rend un handle indépendant. Chaque lecteur crée le sien et, au démontage,
 * lâche simplement la référence. On n'appelle PAS `LibMPV.destroy()` : son
 * implémentation native porte un use-after-free (mesuré par Streamyfin) que
 * rien ne corrige depuis Kotlin. Laisser le ramasse-miettes atteindre le
 * finaliseur est plus sûr qu'un plantage ; l'empreinte native (décodeur,
 * cache du démuxeur) reste allouée jusqu'au lecteur suivant — acceptable,
 * un seul lecteur vit à la fois.
 */
class MPVLib private constructor(private val instance: LibMPV) {

    /** Miroir de `dev.jdtech.mpv.MPVLib.EventObserver`, signature possédée par l'enveloppe. */
    interface EventObserver {
        fun eventProperty(property: String)
        fun eventProperty(property: String, value: Long)
        fun eventProperty(property: String, value: Boolean)
        fun eventProperty(property: String, value: String)
        fun eventProperty(property: String, value: Double)
        fun event(eventId: Int)
    }

    private val observers = mutableListOf<EventObserver>()

    private val libObserver = object : LibMPV.EventObserver {
        override fun eventProperty(property: String) = dispatch { it.eventProperty(property) }
        override fun eventProperty(property: String, value: Long) = dispatch { it.eventProperty(property, value) }
        override fun eventProperty(property: String, value: Boolean) = dispatch { it.eventProperty(property, value) }
        override fun eventProperty(property: String, value: String) = dispatch { it.eventProperty(property, value) }
        override fun eventProperty(property: String, value: Double) = dispatch { it.eventProperty(property, value) }
        override fun event(eventId: Int) = dispatch { it.event(eventId) }

        private inline fun dispatch(block: (EventObserver) -> Unit) {
            synchronized(observers) { observers.forEach(block) }
        }
    }

    fun addObserver(observer: EventObserver) {
        synchronized(observers) { observers.add(observer) }
    }

    fun removeObserver(observer: EventObserver) {
        synchronized(observers) { observers.remove(observer) }
    }

    fun initialize() = instance.init()
    fun attachSurface(surface: android.view.Surface) = instance.attachSurface(surface)
    fun detachSurface() = instance.detachSurface()
    fun command(cmd: Array<String>) = instance.command(cmd)
    fun setOptionString(name: String, value: String): Int = instance.setOptionString(name, value)

    fun getPropertyInt(name: String): Int? = try { instance.getPropertyInt(name) } catch (e: Exception) { null }
    fun getPropertyDouble(name: String): Double? = try { instance.getPropertyDouble(name) } catch (e: Exception) { null }
    fun getPropertyBoolean(name: String): Boolean? = try { instance.getPropertyBoolean(name) } catch (e: Exception) { null }
    fun getPropertyString(name: String): String? = try { instance.getPropertyString(name) } catch (e: Exception) { null }

    fun setPropertyInt(name: String, value: Int) = instance.setPropertyInt(name, value)
    fun setPropertyDouble(name: String, value: Double) = instance.setPropertyDouble(name, value)
    fun setPropertyBoolean(name: String, value: Boolean) = instance.setPropertyBoolean(name, value)
    fun setPropertyString(name: String, value: String) = instance.setPropertyString(name, value)
    fun observeProperty(name: String, format: Int) = instance.observeProperty(name, format)

    companion object {
        /** Un handle mpv neuf, indépendant ; un observateur par lecteur via [addObserver]. */
        fun create(context: Context): MPVLib {
            val lib = LibMPV.create(context) ?: throw IllegalStateException("LibMPV.create returned null")
            val wrapper = MPVLib(lib)
            lib.addObserver(wrapper.libObserver)
            return wrapper
        }

        // Formats d'observation (mpv_format)
        const val MPV_FORMAT_STRING = 1
        const val MPV_FORMAT_FLAG = 3
        const val MPV_FORMAT_INT64 = 4
        const val MPV_FORMAT_DOUBLE = 5

        // Identifiants d'événements (mpv_event_id)
        const val MPV_EVENT_SHUTDOWN = 1
        const val MPV_EVENT_END_FILE = 7
        const val MPV_EVENT_FILE_LOADED = 8
        const val MPV_EVENT_SEEK = 20
        const val MPV_EVENT_PLAYBACK_RESTART = 21
    }
}
