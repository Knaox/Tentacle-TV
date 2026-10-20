package expo.modules.offlinestorage

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

/**
 * Les minuteurs du JavaScript VIVANTS pendant un transfert, application
 * derrière.
 *
 * React Native gèle `setTimeout` dès que l'activité passe en pause
 * (`JavaTimerManager.onHostPause`) — SAUF pendant une tâche « headless ».
 * Le service de premier plan gardait le processus et le flux, mais rien de ce
 * qui attend un délai : relance d'une coupure, délai d'une requête, rythme du
 * suivi en direct. Un transfert coupé une fois écran éteint ne repartait
 * jamais (alpha mobile, 21/10). Le temps que le service tourne, une tâche
 * sans fin (`TentacleOfflineTransfers`, `src/offline/androidKeepAlive.ts`)
 * garde l'horloge en marche ; le JavaScript la termine en rendant sa promesse,
 * le module la termine d'office s'il meurt.
 */
object JsKeepAlive {
  const val TASK_KEY = "TentacleOfflineTransfers"

  @Volatile private var taskId: Int? = null

  fun hold(context: Context): Boolean {
    val react = context as? ReactContext ?: return false
    UiThreadUtil.runOnUiThread {
      try {
        val tasks = HeadlessJsTaskContext.getInstance(react)
        val current = taskId
        if (current != null && tasks.isTaskRunning(current)) return@runOnUiThread
        // Sans délai (0) et permise au premier plan : elle naît pendant que
        // l'application est encore là, au premier transfert.
        taskId = tasks.startTask(HeadlessJsTaskConfig(TASK_KEY, Arguments.createMap(), 0, true))
      } catch (e: Exception) {
        taskId = null
      }
    }
    return true
  }

  fun release(context: Context) {
    val react = context as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      val id = taskId ?: return@runOnUiThread
      taskId = null
      try {
        val tasks = HeadlessJsTaskContext.getInstance(react)
        if (tasks.isTaskRunning(id)) tasks.finishTask(id)
      } catch (e: Exception) {
        // Contexte déjà détruit : la tâche est partie avec lui.
      }
    }
  }
}
