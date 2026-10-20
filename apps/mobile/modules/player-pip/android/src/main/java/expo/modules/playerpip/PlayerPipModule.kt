// Tentacle TV — AGPL-3.0-or-later.
package expo.modules.playerpip

import androidx.activity.ComponentActivity
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Le module Expo « PlayerPip » (Android seulement) — contrat JS : `src/PlayerPip.ts`. */
class PlayerPipModule : Module() {
  private val controller = PipController(
    onModeChanged = { active -> sendEvent("onPipModeChanged", mapOf("active" to active)) },
    onAction = { action -> sendEvent("onPipAction", mapOf("action" to action)) },
    onClosed = { sendEvent("onPipClosed", emptyMap<String, Any>()) },
  )

  private fun activity(): ComponentActivity? = appContext.currentActivity as? ComponentActivity

  override fun definition() = ModuleDefinition {
    Name("PlayerPip")

    Events("onPipModeChanged", "onPipAction", "onPipClosed")

    Function("isSupported") { controller.isSupported(appContext.reactContext) }
    Function("isActive") { controller.isActive() }

    AsyncFunction("configure") { options: Map<String, Any?> ->
      val act = activity() ?: return@AsyncFunction
      @Suppress("UNCHECKED_CAST")
      val labels = (options["labels"] as? Map<String, Any?>)?.mapValues { it.value?.toString() ?: "" } ?: emptyMap()
      controller.configure(
        act,
        PipConfig(
          autoEnter = options["autoEnter"] as? Boolean ?: false,
          playing = options["playing"] as? Boolean ?: false,
          aspectWidth = (options["aspectWidth"] as? Number)?.toInt()?.takeIf { it > 0 } ?: 16,
          aspectHeight = (options["aspectHeight"] as? Number)?.toInt()?.takeIf { it > 0 } ?: 9,
          labels = labels,
        ),
      )
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("enter") { -> controller.enter() }.runOnQueue(Queues.MAIN)

    AsyncFunction("reset") { -> controller.reset() }.runOnQueue(Queues.MAIN)

    OnDestroy { controller.reset() }
  }
}
