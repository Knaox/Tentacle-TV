package expo.modules.octaveaudio

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Le module Expo « OctaveAudio » sur Android : le pont du moteur audio d'Octave
 * (`src/OctaveAudioModule.ts`). Une seule fonction, `invoke(commande, argumentsJson)`
 * → réponse JSON (`""` pour rien), et un seul évènement, `onBridgeEvent { json }`
 * (`AudioBridgeEvent` sérialisé). Les commandes s'exécutent sur le fil principal :
 * celui des ExoPlayer et de la session média.
 */
class OctaveAudioModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("OctaveAudio")

        Events("onBridgeEvent")

        // Ce build lit un flux DIRECT (`open: "direct"`, repli `fallbackUrl`) : la page peut l'adopter.
        Constants("directStreams" to true)

        OnCreate {
            OctaveAudioEngine.setEmitter(this@OctaveAudioModule) { json ->
                sendEvent("onBridgeEvent", mapOf("json" to json))
            }
        }

        OnDestroy {
            OctaveAudioEngine.clearEmitter(this@OctaveAudioModule)
        }

        AsyncFunction("invoke") { command: String, argsJson: String ->
            val context = appContext.reactContext ?: throw IllegalStateException("octave-audio: contexte Android absent")
            OctaveAudioEngine.invoke(context, command, argsJson)
        }.runOnQueue(Queues.MAIN)
    }
}
