package expo.modules.mpvplayer

/** Un sous-titre externe à ajouter (`sub-add`) une fois le fichier chargé. */
data class MpvExternalSubtitle(val url: String, val select: Boolean)

/**
 * Ce que JS demande à `loadfile` : la source, ses en-têtes, la position de
 * départ et la sélection initiale des pistes, en `ff-index` (l'index ffprobe,
 * `MediaStream.Index` chez Jellyfin) — jamais en identifiant mpv, qui n'existe
 * qu'une fois le fichier chargé. Même contrat que `MpvLoadConfig.swift`.
 */
data class MpvLoadConfig(
    val url: String,
    val headers: Map<String, String>?,
    val startPosition: Double?,
    val externalSubtitles: List<MpvExternalSubtitle>,
    val initialAudioFfIndex: Int?,
    val initialSubtitleFfIndex: Int?,
    /** Change pour forcer un rechargement de la MÊME URL (nouvel essai). */
    val reloadToken: String?,
) {
    /** Deux demandes qui désignent la même lecture : même URL, même jeton. */
    fun isSameMedia(other: MpvLoadConfig): Boolean = url == other.url && reloadToken == other.reloadToken

    companion object {
        /** Lit le dictionnaire de la prop `source`. `null` sans URL. */
        fun parse(source: Map<String, Any?>): MpvLoadConfig? {
            val url = source["url"] as? String ?: return null
            @Suppress("UNCHECKED_CAST")
            val externals = (source["externalSubtitles"] as? List<Map<String, Any?>>)?.mapNotNull { entry ->
                val subtitleUrl = entry["url"] as? String ?: return@mapNotNull null
                MpvExternalSubtitle(subtitleUrl, (entry["select"] as? Boolean) ?: false)
            } ?: emptyList()
            @Suppress("UNCHECKED_CAST")
            return MpvLoadConfig(
                url = url,
                headers = source["headers"] as? Map<String, String>,
                startPosition = (source["startPosition"] as? Number)?.toDouble(),
                externalSubtitles = externals,
                initialAudioFfIndex = (source["initialAudioFfIndex"] as? Number)?.toInt(),
                initialSubtitleFfIndex = (source["initialSubtitleFfIndex"] as? Number)?.toInt(),
                reloadToken = source["reloadToken"] as? String,
            )
        }
    }
}
