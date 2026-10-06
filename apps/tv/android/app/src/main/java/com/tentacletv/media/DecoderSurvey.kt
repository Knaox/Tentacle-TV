package com.tentacletv.media

import android.util.Log
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import org.json.JSONArray
import org.json.JSONObject

/**
 * Les décodeurs vidéo MATÉRIELS de l'appareil, vus comme ExoPlayer les voit :
 * la liste de Media3 (`MediaCodecUtil`, ses listes noires comprises) et son
 * test de définition et de cadence (`isVideoSizeAndRateSupportedV21` : points
 * de performance sur Android 10+, sinon `areSizeAndRateSupported`). Le verdict
 * (`devicePlaybackVerdict.ts`) tranche donc comme ExoPlayer le ferait.
 *
 * Les décodeurs logiciels sont écartés : `c2.android.*`, `c2.google.*`,
 * `OMX.google.*`, et tout ce que la plateforme marque `softwareOnly`. Un A53
 * ne tient pas une image décodée sur le processeur.
 */
@UnstableApi
internal object DecoderSurvey {
  private const val TAG = "TentacleMedia"

  /** Type MIME d'Android → codec de Jellyfin. */
  private val VIDEO = linkedMapOf(
    MimeTypes.VIDEO_H264 to "h264",
    MimeTypes.VIDEO_H265 to "hevc",
    MimeTypes.VIDEO_VP9 to "vp9",
    MimeTypes.VIDEO_AV1 to "av1",
    MimeTypes.VIDEO_MPEG2 to "mpeg2video",
    MimeTypes.VIDEO_VC1 to "vc1",
    MimeTypes.VIDEO_MP4V to "mpeg4",
    MimeTypes.VIDEO_VP8 to "vp8",
  )

  /** Les définitions testées, et les cadences essayées de la plus haute à la plus basse. */
  private val SIZES = listOf(1280 to 720, 1920 to 1080, 3840 to 2160)
  private val RATES = doubleArrayOf(120.0, 60.0, 50.0, 48.0, 30.0, 25.0, 24.0)

  private val SOFTWARE_PREFIXES = listOf("c2.android.", "c2.google.", "omx.google.", "omx.ffmpeg.", "c2.ffmpeg.")

  fun isHardware(info: MediaCodecInfo): Boolean {
    val name = info.name.lowercase()
    if (SOFTWARE_PREFIXES.any { name.startsWith(it) }) return false
    return info.hardwareAccelerated && !info.softwareOnly
  }

  private fun hardwareDecoders(mime: String): List<MediaCodecInfo> = try {
    MediaCodecUtil.getDecoderInfos(mime, /* secure= */ false, /* tunneling= */ false).filter(::isHardware)
  } catch (e: Throwable) {
    Log.w(TAG, "décodeurs $mime illisibles : ${e.message}")
    emptyList()
  }

  /** La cadence la plus haute tenue à cette définition, `0` si elle n'est pas décodée. */
  private fun maxFrameRate(info: MediaCodecInfo, width: Int, height: Int): Double {
    val video = info.capabilities?.videoCapabilities ?: return 0.0
    if (!video.isSizeSupported(width, height)) return 0.0
    return RATES.firstOrNull { info.isVideoSizeAndRateSupportedV21(width, height, it) } ?: 0.0
  }

  private fun describe(codec: String, info: MediaCodecInfo): JSONObject {
    val levels = info.capabilities?.profileLevels.orEmpty()
    val video = info.capabilities?.videoCapabilities
    val profiles = levels.mapNotNull { CodecProfileNames.profileName(codec, it.profile) }.distinct()
    val maxLevel = levels.mapNotNull { CodecProfileNames.jellyfinLevel(codec, it.level) }.maxOrNull()
    val sizes = JSONArray()
    for ((w, h) in SIZES) {
      sizes.put(JSONObject().put("width", w).put("height", h).put("maxFrameRate", maxFrameRate(info, w, h)))
    }
    return JSONObject()
      .put("codec", codec)
      .put("decoder", info.name)
      .put("profiles", JSONArray(profiles))
      .put("maxLevel", maxLevel ?: JSONObject.NULL)
      .put("maxWidth", video?.supportedWidths?.upper ?: 0)
      .put("maxHeight", video?.supportedHeights?.upper ?: 0)
      .put("sizes", sizes)
      .put("tenBit", levels.any { CodecProfileNames.isTenBit(codec, it.profile) })
      .put("hdr10", levels.any { CodecProfileNames.isHdr10(codec, it.profile) })
      .put("hdr10Plus", levels.any { CodecProfileNames.isHdr10Plus(codec, it.profile) })
  }

  /** Le meilleur décodeur matériel de chaque codec : la plus grande définition, puis le 10 bits. */
  fun video(): JSONArray {
    val out = JSONArray()
    for ((mime, codec) in VIDEO) {
      val best = hardwareDecoders(mime)
        .map { describe(codec, it) }
        .maxWithOrNull(compareBy({ it.optInt("maxHeight") }, { it.optBoolean("tenBit") }))
      if (best != null) out.put(best)
    }
    return out
  }

  /** Les profils Dolby Vision qu'un décodeur matériel annonce (5, 7, 8…). */
  fun dolbyVisionProfiles(): JSONArray {
    val profiles = hardwareDecoders(MimeTypes.VIDEO_DOLBY_VISION)
      .flatMap { it.capabilities?.profileLevels.orEmpty().toList() }
      .mapNotNull { CodecProfileNames.dolbyVisionProfile(it.profile) }
      .distinct()
      .sorted()
    return JSONArray(profiles)
  }
}
