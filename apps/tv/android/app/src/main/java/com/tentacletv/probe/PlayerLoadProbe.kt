package com.tentacletv.probe

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ViewManager

/**
 * Ce que le lecteur a CHARGÉ — le pendant Android de `PlayerLoadProbe.m`
 * (tvOS), au même nom et au même contrat (`utils/playerLoadProbe.ts`) : la
 * seule façon, pour la reprise du lecteur (`usePlaybackRecovery`,
 * `useStartupWait`), de voir des données ARRIVER pendant une ouverture ou un
 * arrêt, quand aucune progression n'est publiée. Sans elle, Android retombait
 * sur la position et la mémoire vues en lecture.
 *
 * Le lecteur lu est celui qui a ouvert un média en dernier (mpv ou ExoPlayer,
 * un seul monté à la fois) ; `null` sans lecteur. Lu sur le fil principal :
 * ExoPlayer n'accepte que son fil d'application.
 */
interface PlayerLoadSource {
    /** `loadedEnd`, `bytes`, `requests`, `ready` (+ diagnostic) ; `null` : rien d'ouvert. */
    fun loadState(): WritableMap?
}

object PlayerLoadRegistry {
    @Volatile private var current: PlayerLoadSource? = null

    /** Ce lecteur vient d'ouvrir un média : c'est lui qu'on lit. */
    fun attach(source: PlayerLoadSource) { current = source }

    /** Ce lecteur part — seulement s'il est encore celui qu'on lit. */
    fun detach(source: PlayerLoadSource) { if (current === source) current = null }

    fun read(): WritableMap? = current?.loadState()
}

class PlayerLoadProbeModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName(): String = "TentaclePlayerProbe"

    @ReactMethod
    fun loadState(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val state = try { PlayerLoadRegistry.read() } catch (e: Exception) { null }
            promise.resolve(state)
        }
    }
}

class PlayerProbePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(PlayerLoadProbeModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
