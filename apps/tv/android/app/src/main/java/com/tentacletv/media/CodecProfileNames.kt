package com.tentacletv.media

import android.media.MediaCodecInfo.CodecProfileLevel as P

/**
 * Les profils et niveaux d'Android (`CodecProfileLevel`), traduits dans les
 * mots de Jellyfin — ceux qu'il écrit dans `MediaStream.Profile` et `Level` —,
 * pour que la règle partagée (`deviceVideoSupport.ts`) compare des choses
 * comparables. Un profil inconnu n'est pas nommé : il ne sera jamais exigé.
 */
internal object CodecProfileNames {
  /** Le nom Jellyfin d'un profil, ou `null` (inconnu, ou sans nom chez Jellyfin). */
  fun profileName(codec: String, profile: Int): String? = when (codec) {
    "h264" -> when (profile) {
      P.AVCProfileBaseline -> "Baseline"
      P.AVCProfileConstrainedBaseline -> "Constrained Baseline"
      P.AVCProfileMain -> "Main"
      P.AVCProfileExtended -> "Extended"
      P.AVCProfileHigh, P.AVCProfileConstrainedHigh -> "High"
      P.AVCProfileHigh10 -> "High 10"
      P.AVCProfileHigh422 -> "High 4:2:2"
      P.AVCProfileHigh444 -> "High 4:4:4 Predictive"
      else -> null
    }
    "hevc" -> when (profile) {
      P.HEVCProfileMain -> "Main"
      P.HEVCProfileMain10, P.HEVCProfileMain10HDR10, P.HEVCProfileMain10HDR10Plus -> "Main 10"
      P.HEVCProfileMainStill -> "Main Still Picture"
      else -> null
    }
    "vp9" -> when (profile) {
      P.VP9Profile0 -> "Profile 0"
      P.VP9Profile1 -> "Profile 1"
      P.VP9Profile2, P.VP9Profile2HDR, P.VP9Profile2HDR10Plus -> "Profile 2"
      P.VP9Profile3, P.VP9Profile3HDR, P.VP9Profile3HDR10Plus -> "Profile 3"
      else -> null
    }
    "av1" -> when (profile) {
      P.AV1ProfileMain8, P.AV1ProfileMain10, P.AV1ProfileMain10HDR10, P.AV1ProfileMain10HDR10Plus -> "Main"
      else -> null
    }
    // MPEG-2 : une énumération, pas des drapeaux.
    "mpeg2video" -> when (profile) {
      P.MPEG2ProfileSimple -> "Simple"
      P.MPEG2ProfileMain -> "Main"
      P.MPEG2Profile422 -> "4:2:2"
      P.MPEG2ProfileHigh -> "High"
      else -> null
    }
    else -> null
  }

  /** Le profil décode-t-il le 10 bits ? */
  fun isTenBit(codec: String, profile: Int): Boolean = when (codec) {
    "h264" -> profile == P.AVCProfileHigh10 || profile == P.AVCProfileHigh422 || profile == P.AVCProfileHigh444
    "hevc" -> profile == P.HEVCProfileMain10 || profile == P.HEVCProfileMain10HDR10 || profile == P.HEVCProfileMain10HDR10Plus
    "vp9" -> profile == P.VP9Profile2 || profile == P.VP9Profile3 || profile == P.VP9Profile2HDR ||
      profile == P.VP9Profile3HDR || profile == P.VP9Profile2HDR10Plus || profile == P.VP9Profile3HDR10Plus
    "av1" -> profile == P.AV1ProfileMain10 || profile == P.AV1ProfileMain10HDR10 || profile == P.AV1ProfileMain10HDR10Plus
    else -> false
  }

  fun isHdr10(codec: String, profile: Int): Boolean = when (codec) {
    "hevc" -> profile == P.HEVCProfileMain10HDR10 || profile == P.HEVCProfileMain10HDR10Plus
    "vp9" -> profile == P.VP9Profile2HDR || profile == P.VP9Profile3HDR || profile == P.VP9Profile2HDR10Plus || profile == P.VP9Profile3HDR10Plus
    "av1" -> profile == P.AV1ProfileMain10HDR10 || profile == P.AV1ProfileMain10HDR10Plus
    else -> false
  }

  fun isHdr10Plus(codec: String, profile: Int): Boolean = when (codec) {
    "hevc" -> profile == P.HEVCProfileMain10HDR10Plus
    "vp9" -> profile == P.VP9Profile2HDR10Plus || profile == P.VP9Profile3HDR10Plus
    "av1" -> profile == P.AV1ProfileMain10HDR10Plus
    else -> false
  }

  /** H.264 : AVCLevel1 (1) … AVCLevel62 (0x80000), un bit par niveau. */
  private val AVC_LEVELS = intArrayOf(10, 9, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62)

  /** HEVC : deux bits par niveau (Main, High), et Jellyfin compte 30 × le niveau. */
  private val HEVC_LEVELS = intArrayOf(30, 60, 63, 90, 93, 120, 123, 150, 153, 156, 180, 183, 186)

  /** VP9 : VP9Level1 (1) … VP9Level62 (0x2000). */
  private val VP9_LEVELS = intArrayOf(10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 52, 60, 61, 62)

  /** Le niveau dans l'unité de Jellyfin, ou `null`. AV1 : `seq_level_idx`, le rang du bit. */
  fun jellyfinLevel(codec: String, level: Int): Int? {
    if (level <= 0) return null
    val bit = Integer.numberOfTrailingZeros(level)
    return when (codec) {
      "h264" -> AVC_LEVELS.getOrNull(bit)
      "hevc" -> HEVC_LEVELS.getOrNull(bit / 2)
      "vp9" -> VP9_LEVELS.getOrNull(bit)
      "av1" -> bit
      else -> null
    }
  }

  /** Le numéro d'un profil Dolby Vision (DolbyVisionProfileDvheSt = 0x100 → 8). */
  fun dolbyVisionProfile(profile: Int): Int? = if (profile > 0 && Integer.bitCount(profile) == 1) Integer.numberOfTrailingZeros(profile) else null
}
