package com.tentacletv.media

import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Display
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioCapabilitiesReceiver
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.tentacletv.BuildConfig
import com.tentacletv.exoplayer.ExoPlayerFactory
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Le profil de décodage de CET appareil (`DeviceMediaProfile`, shared), rendu
 * en JSON au JS : décodeurs matériels, Dolby Vision, HDR de l'écran, son HDMI,
 * sortie.
 *
 * - Lu à la PREMIÈRE demande (l'ouverture du lecteur), hors du fil principal :
 *   rien au démarrage de l'app. Les décodeurs ne changent pas pendant la vie
 *   du processus, ils ne se relisent jamais ; la sortie (écran, HDMI) se relit
 *   quand elle change — un `DisplayListener` et le receveur HDMI de Media3,
 *   posés à la première demande — et le JS en est prévenu
 *   (`TentacleMediaProfileChanged`), qui redemande.
 * - Un banc injecte un profil SIMULÉ : `debug.tentacle.media_profile` (cf.
 *   `simulatedDeviceProfiles.ts`). Écouté par l'app de MESURE (`*.perf`) et
 *   une construction de développement seulement : une propriété oubliée sur un
 *   vrai appareil ne change jamais le profil de l'app de l'utilisateur.
 * - Relevé SANS une touche (la Shield partagée) : la valeur `survey` fait
 *   écrire le profil réel dans le journal 5 s après le lancement —
 *   `adb shell setprop debug.tentacle.media_profile survey`, `am start`, puis
 *   `adb logcat -s TentacleMedia`. Aucun nom simulé ne s'appelle ainsi : le
 *   lecteur garde le profil réel.
 */
@UnstableApi
class MediaCapabilitiesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val TAG = "TentacleMedia"
    private const val EVENT = "TentacleMediaProfileChanged"
    private const val PROPERTY = "debug.tentacle.media_profile"
    private const val VERSION = 1
    private const val SURVEY = "survey"
    private const val SURVEY_DELAY_MS = 5_000L
  }

  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "tentacle-media-caps").apply { isDaemon = true } }
  private val main = Handler(Looper.getMainLooper())

  @Volatile private var decoders: Pair<org.json.JSONArray, org.json.JSONArray>? = null
  @Volatile private var output: JSONObject? = null
  private var displayListener: DisplayManager.DisplayListener? = null
  private var audioReceiver: AudioCapabilitiesReceiver? = null

  override fun getName() = "TentacleMediaCapabilities"

  override fun initialize() {
    super.initialize()
    if (simulatedName() != SURVEY) return
    main.postDelayed({
      executor.execute {
        try {
          val started = SystemClock.elapsedRealtime()
          val json = profileJson().toString()
          logProfile("relevé au lancement (${SystemClock.elapsedRealtime() - started} ms)", json)
        } catch (e: Throwable) {
          Log.w(TAG, "relevé au lancement impossible : ${e.message}")
        }
      }
    }, SURVEY_DELAY_MS)
  }

  /** Le nom du profil simulé demandé par le banc, ou `null`. */
  private fun simulatedName(): String? {
    val measurementApp = context.packageName.endsWith(".perf") || BuildConfig.DEBUG
    if (!measurementApp) return null
    val value = try {
      Class.forName("android.os.SystemProperties").getMethod("get", String::class.java).invoke(null, PROPERTY) as? String
    } catch (_: Throwable) {
      null
    }
    return value?.trim()?.takeIf { it.isNotEmpty() }
  }

  /** Le profil au journal, par morceaux numérotés : logcat coupe une ligne vers 4 Ko. */
  private fun logProfile(title: String, json: String) {
    val parts = json.chunked(3000)
    parts.forEachIndexed { i, part -> Log.i(TAG, "$title [${i + 1}/${parts.size}] $part") }
  }

  /** La sortie (écran, HDR de l'écran, son), relue à chaque changement. */
  private fun readOutput(): JSONObject = JSONObject()
    .put("display", OutputSurvey.display(context))
    .put("displayHdr", OutputSurvey.displayHdr(context))
    .put("audio", OutputSurvey.audio(context))

  private fun profileJson(): JSONObject {
    val (video, dolbyVision) = decoders ?: Pair(DecoderSurvey.video(), DecoderSurvey.dolbyVisionProfiles()).also { decoders = it }
    val out = output ?: readOutput().also { output = it }
    return JSONObject()
      .put("version", VERSION)
      .put("source", "native")
      .put("name", OutputSurvey.deviceName())
      .put("sdk", Build.VERSION.SDK_INT)
      .put("video", video)
      .put("hdr", JSONObject().put("display", out.getJSONObject("displayHdr")).put("dolbyVisionProfiles", dolbyVision))
      .put("audio", out.getJSONObject("audio"))
      .put("display", out.getJSONObject("display"))
  }

  /**
   * `{ json, simulated, elapsedMs }` : le profil réel (JSON du type partagé),
   * le nom du profil simulé à lui substituer (ou `null`), et le temps du relevé.
   */
  @ReactMethod
  fun getProfile(promise: Promise) {
    executor.execute {
      try {
        val started = SystemClock.elapsedRealtime()
        val json = profileJson().toString()
        val elapsed = SystemClock.elapsedRealtime() - started
        logProfile("profil (${elapsed} ms)", json)
        main.post(::watchOutput)
        promise.resolve(Arguments.createMap().apply {
          putString("json", json)
          putString("simulated", simulatedName())
          putDouble("elapsedMs", elapsed.toDouble())
        })
      } catch (e: Throwable) {
        Log.w(TAG, "profil illisible : ${e.message}")
        promise.reject("E_MEDIA_PROFILE", e)
      }
    }
  }

  /** Un changement de sortie : relu en arrière-plan, puis le JS prévenu s'il a changé. */
  private fun outputChanged() {
    executor.execute {
      val next = try { readOutput() } catch (_: Throwable) { return@execute }
      if (next.toString() == output?.toString()) return@execute
      output = next
      Log.i(TAG, "sortie changée : $next")
      main.post {
        if (context.hasActiveReactInstance()) {
          context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(EVENT, null)
        }
      }
    }
  }

  /** Posés une fois, à la première demande — fil principal (le receveur veut un Looper). */
  private fun watchOutput() {
    if (displayListener != null) return
    val manager = context.getSystemService(DisplayManager::class.java) ?: return
    displayListener = object : DisplayManager.DisplayListener {
      override fun onDisplayAdded(displayId: Int) = Unit
      override fun onDisplayRemoved(displayId: Int) = Unit
      override fun onDisplayChanged(displayId: Int) {
        if (displayId == Display.DEFAULT_DISPLAY) outputChanged()
      }
    }.also { manager.registerDisplayListener(it, main) }
    audioReceiver = AudioCapabilitiesReceiver(context, { outputChanged() }, ExoPlayerFactory.mediaAudioAttributes, null)
      .also { it.register() }
  }

  // Requis par NativeEventEmitter côté JS.
  @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit
  @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) = Unit

  override fun invalidate() {
    main.post {
      displayListener?.let { context.getSystemService(DisplayManager::class.java)?.unregisterDisplayListener(it) }
      displayListener = null
      audioReceiver?.unregister()
      audioReceiver = null
    }
    executor.shutdown()
    super.invalidate()
  }
}
