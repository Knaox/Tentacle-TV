package com.tentacletv.exoplayer

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import com.facebook.react.bridge.ReadableArray

/** Une piste texte side-loadée (VTT / ASS Jellyfin), fournie par la prop `textTracks`. */
data class TextTrackConfig(
    val uri: String, val language: String, val label: String, val jellyfinIndex: Int,
)

/** La fabrique de `MediaItem` — URL, position de départ, pistes texte — sortie de la vue. */
object ExoMediaSource {

    /** Extracts the `#tnt-start=<seconds>` fragment appended by the JS layer.
     *  Returns the clean URL + start position in ms. Fragments are never sent
     *  over HTTP, this is purely a side-channel for the initial position. */
    fun parseStartFragment(url: String): Pair<String, Long> {
        val marker = "#tnt-start="
        val idx = url.indexOf(marker)
        if (idx < 0) return Pair(url, 0L)
        val sec = url.substring(idx + marker.length).toDoubleOrNull() ?: 0.0
        return Pair(url.substring(0, idx), (sec * 1000).toLong())
    }

    /** MimeType d'une piste de sous-titre selon l'extension de l'URL Jellyfin.
     *  ASS/SSA → text/x-ssa (rendu natif via SsaParser + legacy decoding),
     *  SRT → application/x-subrip, sinon WebVTT. */
    fun mimeForSubtitleUrl(url: String): String {
        val path = url.substringBefore('?').lowercase()
        return when {
            path.endsWith(".ass") || path.endsWith(".ssa") -> MimeTypes.TEXT_SSA
            path.endsWith(".srt") -> MimeTypes.APPLICATION_SUBRIP
            else -> MimeTypes.TEXT_VTT
        }
    }

    /**
     * Le MediaItem d'une lecture : URL nettoyée + toutes les pistes texte
     * side-loadées d'emblée (rendu natif par le subtitleView, sélection via
     * setSubtitleTrack sans re-prepare). `setId("jf:<jellyfinIndex>")` : clé de
     * mapping fiable, le préfixe la distingue des Format.id NUMÉRIQUES des
     * pistes embarquées (numéros de piste Matroska — cf. buildTrackList). PAS de
     * SELECTION_FLAG_DEFAULT → état initial OFF. Rend aussi la position de
     * départ (ms) portée par le fragment.
     */
    fun buildMediaItem(url: String, textTracks: List<TextTrackConfig>): Pair<MediaItem, Long> {
        val (cleanUrl, startMs) = parseStartFragment(url)
        val builder = MediaItem.Builder().setUri(Uri.parse(cleanUrl))
        if (textTracks.isNotEmpty()) {
            builder.setSubtitleConfigurations(textTracks.map { t ->
                MediaItem.SubtitleConfiguration.Builder(Uri.parse(t.uri))
                    .setId("jf:${t.jellyfinIndex}")
                    .setMimeType(mimeForSubtitleUrl(t.uri))
                    .setLanguage(t.language.ifEmpty { null })
                    .setLabel(t.label.ifEmpty { null })
                    .build()
            })
        }
        return Pair(builder.build(), startMs)
    }

    /** Le MediaItem d'un rechargement de sous-titre unique (`loadSubtitle`) :
     *  la VTT en piste par défaut, ou aucune piste. */
    fun buildSubtitleItem(videoUrl: String, subtitleUrl: String?): MediaItem {
        val builder = MediaItem.Builder().setUri(Uri.parse(parseStartFragment(videoUrl).first))
        if (subtitleUrl != null && subtitleUrl.isNotEmpty()) {
            builder.setSubtitleConfigurations(listOf(
                MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                    .setMimeType(MimeTypes.TEXT_VTT)
                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                    .build()
            ))
        } else {
            builder.setSubtitleConfigurations(emptyList())
        }
        return builder.build()
    }

    /** La prop `textTracks` (tableau JS) → liste typée. */
    fun parseTextTracks(tracks: ReadableArray?): List<TextTrackConfig> {
        val list = mutableListOf<TextTrackConfig>()
        if (tracks != null) {
            for (i in 0 until tracks.size()) {
                val m = tracks.getMap(i) ?: continue
                val uri = m.getString("uri") ?: continue
                list.add(TextTrackConfig(
                    uri = uri,
                    language = m.getString("language") ?: "",
                    label = m.getString("label") ?: "",
                    jellyfinIndex = if (m.hasKey("jellyfinIndex")) m.getInt("jellyfinIndex") else -1,
                ))
            }
        }
        return list
    }
}
