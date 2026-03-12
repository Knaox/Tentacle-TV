package com.tentacletv.exoplayer

import android.content.Context
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.os.Handler
import android.util.Log
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.video.MediaCodecVideoRenderer
import androidx.media3.exoplayer.video.VideoRendererEventListener

/**
 * Dolby Vision Profile 7 → Profile 8.1 compatibility renderer.
 *
 * Many Android TV devices have a DV Profile 8 decoder (dvhe.08) but not Profile 7 (dvhe.07).
 * Profile 7 uses dual-layer (BL+EL), while Profile 8 is single-layer.
 * This renderer rewrites P7 codec strings to P8 so the device's P8 decoder accepts the stream.
 * The Enhancement Layer is dropped (MEL-only — Full EL cannot be converted).
 *
 * Technique from JellyDV / VoidTV projects.
 */
@UnstableApi
class DvCompatRenderer(
    context: Context,
    mediaCodecSelector: MediaCodecSelector,
    enableDecoderFallback: Boolean,
    eventHandler: Handler,
    eventListener: VideoRendererEventListener,
    allowedVideoJoiningTimeMs: Long,
) : MediaCodecVideoRenderer(
    context,
    mediaCodecSelector,
    allowedVideoJoiningTimeMs,
    enableDecoderFallback,
    eventHandler,
    eventListener,
    0,
) {
    companion object {
        private const val TAG = "DvCompatRenderer"

        // DV Profile 7 codec prefix
        private const val DV_P7_PREFIX = "dvhe.07"
        private const val DV_P8_PREFIX = "dvhe.08"

        // MIME type for Dolby Vision
        private const val MIME_DV_HEVC = MimeTypes.VIDEO_DOLBY_VISION

        /**
         * Check if the device has a decoder for a given codec string.
         */
        private fun hasDecoderFor(mimeType: String, codecString: String): Boolean {
            val codecList = MediaCodecList(MediaCodecList.ALL_CODECS)
            return codecList.codecInfos.any { info ->
                if (info.isEncoder) return@any false
                info.supportedTypes.any { type ->
                    type.equals(mimeType, ignoreCase = true) &&
                        try {
                            val caps = info.getCapabilitiesForType(type)
                            caps.isFormatSupported(
                                android.media.MediaFormat.createVideoFormat(mimeType, 3840, 2160)
                                    .apply { setString(android.media.MediaFormat.KEY_CODECS_STRING, codecString) }
                            )
                        } catch (_: Exception) {
                            false
                        }
                }
            }
        }

        /**
         * Check if device supports DV Profile 8 but not Profile 7.
         */
        fun shouldRewriteP7toP8(): Boolean {
            val hasP7 = hasDecoderFor(MIME_DV_HEVC, "dvhe.07.06")
            val hasP8 = hasDecoderFor(MIME_DV_HEVC, "dvhe.08.06")
            Log.w(TAG, ">>> Device DV support: P7=$hasP7 P8=$hasP8")
            return !hasP7 && hasP8
        }
    }

    private var rewriteEnabled = false

    init {
        // Check on init if we should rewrite
        rewriteEnabled = shouldRewriteP7toP8()
        Log.w(TAG, ">>> DvCompatRenderer init, rewrite=${rewriteEnabled}")
    }

    override fun supportsFormat(mediaCodecSelector: MediaCodecSelector, format: Format): Int {
        // If this is a DV P7 format and we can rewrite it, claim support
        val codecs = format.codecs
        if (rewriteEnabled && codecs != null && codecs.startsWith(DV_P7_PREFIX)) {
            val rewrittenCodecs = codecs.replace(DV_P7_PREFIX, DV_P8_PREFIX)
            val rewrittenFormat = format.buildUpon()
                .setCodecs(rewrittenCodecs)
                .build()
            Log.w(TAG, ">>> supportsFormat: DV P7 detected, checking P8 support for $rewrittenCodecs")
            return super.supportsFormat(mediaCodecSelector, rewrittenFormat)
        }
        return super.supportsFormat(mediaCodecSelector, format)
    }

    override fun getDecoderInfos(
        mediaCodecSelector: MediaCodecSelector,
        format: Format,
        requiresSecureDecoder: Boolean,
    ): List<androidx.media3.exoplayer.mediacodec.MediaCodecInfo> {
        val codecs = format.codecs
        if (rewriteEnabled && codecs != null && codecs.startsWith(DV_P7_PREFIX)) {
            // Rewrite P7 → P8 to find a compatible decoder
            val rewrittenCodecs = codecs.replace(DV_P7_PREFIX, DV_P8_PREFIX)
            val rewrittenFormat = format.buildUpon()
                .setCodecs(rewrittenCodecs)
                .build()
            Log.w(TAG, ">>> getDecoderInfos: rewriting $codecs → $rewrittenCodecs")
            val decoders = super.getDecoderInfos(mediaCodecSelector, rewrittenFormat, requiresSecureDecoder)
            if (decoders.isNotEmpty()) {
                Log.w(TAG, ">>> getDecoderInfos: found ${decoders.size} P8 decoders")
                return decoders
            }
            Log.w(TAG, ">>> getDecoderInfos: no P8 decoders found, falling through")
        }
        return super.getDecoderInfos(mediaCodecSelector, format, requiresSecureDecoder)
    }
}
