package com.tentacletv.media

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import androidx.media3.common.C
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.decoder.ffmpeg.FfmpegLibrary
import androidx.media3.exoplayer.audio.AudioCapabilities
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import com.tentacletv.exoplayer.ExoPlayerFactory
import org.json.JSONArray
import org.json.JSONObject

/**
 * Ce que l'appareil SORT : l'écran (mode en cours, plus grand mode, plages
 * HDR qu'il annonce) et le son (encodages reçus tels quels par la sortie
 * HDMI, au sens de Media3 ; sons que l'appareil décode lui-même). Ce qui
 * change quand on rebranche l'HDMI ou qu'on change de mode — relu alors par
 * `MediaCapabilitiesModule`.
 */
@UnstableApi
internal object OutputSurvey {
  /** Codec de Jellyfin → type MIME, pour les sons que l'appareil décode. */
  private val AUDIO = linkedMapOf(
    "aac" to MimeTypes.AUDIO_AAC,
    "ac3" to MimeTypes.AUDIO_AC3,
    "eac3" to MimeTypes.AUDIO_E_AC3,
    "dts" to MimeTypes.AUDIO_DTS,
    "truehd" to MimeTypes.AUDIO_TRUEHD,
    "flac" to MimeTypes.AUDIO_FLAC,
    "opus" to MimeTypes.AUDIO_OPUS,
    "mp3" to MimeTypes.AUDIO_MPEG,
    "vorbis" to MimeTypes.AUDIO_VORBIS,
    "alac" to MimeTypes.AUDIO_ALAC,
  )

  /** Encodage de passthrough (Media3) → nom du profil partagé. */
  private val PASSTHROUGH = linkedMapOf(
    "ac3" to C.ENCODING_AC3,
    "eac3" to C.ENCODING_E_AC3,
    "eac3-joc" to C.ENCODING_E_AC3_JOC,
    "truehd" to C.ENCODING_DOLBY_TRUEHD,
    "dts" to C.ENCODING_DTS,
    "dtshd" to C.ENCODING_DTS_HD,
  )

  private fun defaultDisplay(context: Context): Display? =
    (context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager)?.getDisplay(Display.DEFAULT_DISPLAY)

  /** Les plages HDR de l'écran : celles du mode (Android 14+), sinon celles de l'écran. */
  @Suppress("DEPRECATION")
  private fun hdrTypes(display: Display?): IntArray {
    if (display == null) return IntArray(0)
    if (Build.VERSION.SDK_INT >= 34) return display.mode.supportedHdrTypes
    return display.hdrCapabilities?.supportedHdrTypes ?: IntArray(0)
  }

  fun display(context: Context): JSONObject {
    val display = defaultDisplay(context)
    val mode = display?.mode
    val largest = display?.supportedModes?.maxByOrNull { it.physicalWidth * it.physicalHeight }
    return JSONObject()
      .put("width", mode?.physicalWidth ?: 0)
      .put("height", mode?.physicalHeight ?: 0)
      .put("refreshRate", (mode?.refreshRate ?: 0f).toDouble())
      .put("maxWidth", largest?.physicalWidth ?: 0)
      .put("maxHeight", largest?.physicalHeight ?: 0)
  }

  @Suppress("DEPRECATION")
  fun displayHdr(context: Context): JSONObject {
    val types = hdrTypes(defaultDisplay(context))
    return JSONObject()
      .put("hdr10", Display.HdrCapabilities.HDR_TYPE_HDR10 in types)
      .put("hdr10Plus", Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS in types)
      .put("hlg", Display.HdrCapabilities.HDR_TYPE_HLG in types)
      .put("dolbyVision", Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION in types)
  }

  private fun platformDecodes(mime: String): Boolean = try {
    MediaCodecUtil.getDecoderInfos(mime, false, false).isNotEmpty()
  } catch (_: Throwable) {
    false
  }

  private fun ffmpegDecodes(mime: String): Boolean = try {
    FfmpegLibrary.isAvailable() && FfmpegLibrary.supportsFormat(mime)
  } catch (_: Throwable) {
    false
  }

  /**
   * Le son : la sortie telle que Media3 la voit (les mêmes attributs que le
   * lecteur), et les sons décodés — plateforme ou extension FFmpeg du lecteur
   * (son renderer passe après ceux de la plateforme). Le PCM n'a pas besoin
   * de décodeur.
   */
  fun audio(context: Context): JSONObject {
    val caps = AudioCapabilities.getCapabilities(context, ExoPlayerFactory.mediaAudioAttributes, null)
    val passthrough = PASSTHROUGH.filter { (_, encoding) -> caps.supportsEncoding(encoding) }.keys
    val decoded = AUDIO.filter { (_, mime) -> platformDecodes(mime) || ffmpegDecodes(mime) }.keys + listOf("pcm_s16le", "pcm_s24le")
    return JSONObject()
      .put("passthrough", JSONArray(passthrough.toList()))
      .put("decoded", JSONArray(decoded))
      .put("maxPcmChannels", caps.maxChannelCount)
  }

  /** L'appareil, pour le rapport : marque, modèle, puce. */
  fun deviceName(): String {
    val soc = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else Build.HARDWARE
    return "${Build.MANUFACTURER} ${Build.MODEL} · $soc".trim()
  }
}
