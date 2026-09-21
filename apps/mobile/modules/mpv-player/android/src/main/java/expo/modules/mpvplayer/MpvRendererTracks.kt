// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLayerRenderer.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : une seule énumération, résolution par ff-index.
package expo.modules.mpvplayer

/** Toutes les pistes telles que mpv les voit, avec l'identité qui compte pour Jellyfin. */
internal fun MpvRenderer.trackList(handle: MPVLib): List<Map<String, Any>> {
    val tracks = mutableListOf<Map<String, Any>>()
    val count = handle.getPropertyInt("track-list/count") ?: 0
    for (index in 0 until count) {
        val prefix = "track-list/$index/"
        val type = handle.getPropertyString(prefix + "type") ?: continue
        val id = handle.getPropertyInt(prefix + "id") ?: continue
        val track = mutableMapOf<String, Any>("id" to id, "type" to type)
        handle.getPropertyInt(prefix + "ff-index")?.let { track["ffIndex"] = it }
        val external = handle.getPropertyBoolean(prefix + "external") ?: false
        track["external"] = external
        if (external) handle.getPropertyString(prefix + "external-filename")?.let { track["externalFilename"] = it }
        handle.getPropertyString(prefix + "title")?.let { track["title"] = it }
        handle.getPropertyString(prefix + "lang")?.let { track["lang"] = it }
        handle.getPropertyString(prefix + "codec")?.let { track["codec"] = it }
        if (type == "audio") handle.getPropertyInt(prefix + "audio-channels")?.takeIf { it > 0 }?.let { track["channels"] = it }
        if (type == "video") {
            handle.getPropertyInt(prefix + "demux-w")?.let { track["width"] = it }
            handle.getPropertyInt(prefix + "demux-h")?.let { track["height"] = it }
        }
        track["selected"] = handle.getPropertyBoolean(prefix + "selected") ?: false
        track["default"] = handle.getPropertyBoolean(prefix + "default") ?: false
        track["forced"] = handle.getPropertyBoolean(prefix + "forced") ?: false
        tracks.add(track)
    }
    return tracks
}

/** L'identifiant mpv de la piste intégrée dont le `ff-index` vaut [ffIndex] ; les externes sont ignorées. */
internal fun MpvRenderer.trackId(handle: MPVLib, ffIndex: Int, type: String): Int? {
    val count = handle.getPropertyInt("track-list/count") ?: 0
    for (index in 0 until count) {
        val prefix = "track-list/$index/"
        if (handle.getPropertyString(prefix + "type") != type) continue
        if (handle.getPropertyBoolean(prefix + "external") == true) continue
        if (handle.getPropertyInt(prefix + "ff-index") != ffIndex) continue
        return handle.getPropertyInt(prefix + "id")
    }
    return null
}

private fun MpvRenderer.subtitleCodec(handle: MPVLib, trackId: Int): String? {
    val count = handle.getPropertyInt("track-list/count") ?: 0
    for (index in 0 until count) {
        val prefix = "track-list/$index/"
        if (handle.getPropertyString(prefix + "type") != "sub") continue
        if (handle.getPropertyInt(prefix + "id") != trackId) continue
        return handle.getPropertyString(prefix + "codec")
    }
    return null
}

/** Un ASS aux scripts droite-à-gauche a besoin d'`Encoding=-1` ; rien d'autre de son style n'est touché. */
internal fun MpvRenderer.applyBidiMode(handle: MPVLib, trackId: Int) {
    val codec = if (trackId >= 0) subtitleCodec(handle, trackId) else null
    val isAss = codec == "ass" || codec == "ssa"
    handle.setPropertyString("sub-ass-style-overrides", if (isAss) "Encoding=-1" else "")
}

fun MpvRenderer.getTracks(): List<Map<String, Any>> = mpv?.let { trackList(it) } ?: emptyList()

/** `id` mpv ; négatif = aucune piste audio. */
fun MpvRenderer.setAudioTrack(id: Int) {
    val handle = mpv ?: return
    if (id < 0) handle.setPropertyString("aid", "no") else handle.setPropertyInt("aid", id)
}

/** `id` mpv ; négatif = sous-titres coupés. */
fun MpvRenderer.setSubtitleTrack(id: Int) {
    val handle = mpv ?: return
    if (id < 0) handle.setPropertyString("sid", "no") else handle.setPropertyInt("sid", id)
    applyBidiMode(handle, id)
}

/** Ajoute un sous-titre externe ; la liste des pistes se remonte d'elle-même (`track-list/count`). */
fun MpvRenderer.addSubtitle(url: String, select: Boolean) {
    val handle = mpv ?: return
    handle.command(arrayOf("sub-add", url, if (select) "select" else "auto"))
    if (select) applyBidiMode(handle, handle.getPropertyInt("sid") ?: -1)
}

/** Instantané pour le panneau « Détails ». */
fun MpvRenderer.getTechnicalInfo(): Map<String, Any> {
    val handle = mpv ?: return emptyMap()
    val info = mutableMapOf<String, Any>()
    handle.getPropertyInt("video-params/w")?.takeIf { it > 0 }?.let { info["videoWidth"] = it }
    handle.getPropertyInt("video-params/h")?.takeIf { it > 0 }?.let { info["videoHeight"] = it }
    handle.getPropertyString("video-format")?.let { info["videoCodec"] = it }
    handle.getPropertyString("audio-codec-name")?.let { info["audioCodec"] = it }
    handle.getPropertyDouble("container-fps")?.takeIf { it > 0 }?.let { info["fps"] = it }
    handle.getPropertyInt("video-bitrate")?.takeIf { it > 0 }?.let { info["videoBitrate"] = it }
    handle.getPropertyInt("audio-bitrate")?.takeIf { it > 0 }?.let { info["audioBitrate"] = it }
    handle.getPropertyDouble("demuxer-cache-duration")?.let { info["cacheSeconds"] = it }
    handle.getPropertyInt("frame-drop-count")?.let { info["droppedFrames"] = it }
    handle.getPropertyString("hwdec-current")?.let { info["hwdec"] = it }
    handle.getPropertyString("current-ao")?.let { info["audioOutput"] = it }
    handle.getPropertyString("audio-params/channels")?.let { info["audioChannels"] = it }
    info["hdr"] = hdrMode(handle)
    info["log"] = MpvLogger.recent()
    return info
}

/** bt.2020 + PQ = HDR10, bt.2020 + HLG = HLG, le reste SDR ; « unknown » avant la première image. */
internal fun MpvRenderer.hdrMode(handle: MPVLib): String {
    val primaries = handle.getPropertyString("video-params/primaries") ?: return "unknown"
    if (primaries != "bt.2020" && primaries != "bt.2020-ncl") return "sdr"
    return if (handle.getPropertyString("video-params/gamma") == "hlg") "hlg" else "hdr10"
}
