// Tentacle TV — AGPL-3.0-or-later (lié aux Google Play services par LICENSE-EXCEPTIONS §2).
package expo.modules.tentaclecast

import androidx.mediarouter.app.MediaRouteChooserDialog
import androidx.mediarouter.app.MediaRouteControllerDialog
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Le module Expo « TentacleCast » (Android seulement) — contrat JS : `src/TentacleCast.ts`. */
class TentacleCastModule : Module() {
  private val bridge = CastBridge(
    emitState = { sendEvent("onCastState", it) },
    emitStatus = { sendEvent("onCastStatus", it) },
  )

  override fun definition() = ModuleDefinition {
    Name("TentacleCast")

    Events("onCastState", "onCastStatus")

    AsyncFunction("start") { -> bridge.start(appContext.reactContext?.applicationContext) }.runOnQueue(Queues.MAIN)
    AsyncFunction("getState") { -> bridge.stateMap() }.runOnQueue(Queues.MAIN)
    AsyncFunction("getStatus") { -> bridge.statusMap() }.runOnQueue(Queues.MAIN)

    // Le choix de la TV (ou, connecté, la fenêtre qui arrête la diffusion) : les
    // fenêtres de MediaRouter, celles que tout utilisateur de Cast connaît.
    AsyncFunction("showPicker") { ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (bridge.isConnected()) {
        MediaRouteControllerDialog(activity).show()
        return@AsyncFunction true
      }
      val selector = bridge.mergedSelector() ?: return@AsyncFunction false
      MediaRouteChooserDialog(activity).apply { routeSelector = selector }.show()
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("load") { request: Map<String, Any?> ->
      val url = request["url"] as? String ?: return@AsyncFunction false
      bridge.load(
        CastLoad(
          url = url,
          contentType = request["contentType"] as? String ?: "video/mp4",
          title = request["title"] as? String ?: "",
          subtitle = request["subtitle"] as? String,
          imageUrl = request["imageUrl"] as? String,
          startSeconds = (request["startSeconds"] as? Number)?.toDouble() ?: 0.0,
          durationSeconds = (request["durationSeconds"] as? Number)?.toDouble() ?: 0.0,
          textTrackUrl = request["textTrackUrl"] as? String,
          textTrackLanguage = request["textTrackLanguage"] as? String,
          textTrackName = request["textTrackName"] as? String,
        ),
      )
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { -> bridge.play() }.runOnQueue(Queues.MAIN)
    AsyncFunction("pause") { -> bridge.pause() }.runOnQueue(Queues.MAIN)
    AsyncFunction("seek") { seconds: Double -> bridge.seek(seconds) }.runOnQueue(Queues.MAIN)
    AsyncFunction("endSession") { -> bridge.endSession() }.runOnQueue(Queues.MAIN)

    OnDestroy { bridge.stop() }
  }
}
