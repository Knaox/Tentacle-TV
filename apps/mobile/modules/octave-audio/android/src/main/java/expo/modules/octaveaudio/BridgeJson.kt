package expo.modules.octaveaudio

import org.json.JSONArray
import org.json.JSONObject

// Le pont en JSON, champ pour champ comme `audioBridgeContract.ts` : la lecture
// des arguments des commandes et l'écriture des évènements. org.json seulement.
// ⚠️ Les noms des champs traversent le pont : ils ne se renomment jamais.

internal data class BridgeReplayGain(
    val trackGainDb: Double?,
    val trackPeak: Double?,
    val albumGainDb: Double?,
    val albumPeak: Double?,
)

internal data class BridgeMeta(val title: String, val artist: String?, val album: String?, val artworkUrl: String?)

internal data class BridgeTrack(val trackKey: String, val albumKey: String?, val durationMs: Long?, val meta: BridgeMeta?)

/**
 * `kept`, `complete`… sont ignorés ici : le JS a déjà résolu la copie gardée en `file://`. `direct` : `url` est
 * un flux DIRECT (requêtes déléguées, jugé par la page), ouvert sans les en-têtes du serveur ; `fallbackUrl`
 * est son repli (le serveur, `direct=failed`), lu à son premier échec.
 */
internal data class BridgeSource(
    val url: String,
    val origin: String,
    val durationMs: Long?,
    val replayGain: BridgeReplayGain?,
    val direct: Boolean = false,
    val fallbackUrl: String? = null,
) {
    /** La même source, lue par le serveur ; `null` sans repli. */
    fun serverFallback(): BridgeSource? = if (direct && fallbackUrl != null) copy(url = fallbackUrl, direct = false, fallbackUrl = null) else null
}

internal data class BridgeStart(
    val serverOrigin: String,
    val headers: Map<String, String>,
    val volume: Double,
    val muted: Boolean,
    val replayGain: String,
)

/** Ce que dit un évènement `state` (`AudioBridgeState`), sans l'horodatage. */
internal data class BridgeState(
    val status: String,
    val trackKey: String?,
    val positionMs: Long,
    val durationMs: Long?,
    val volume: Double,
    val muted: Boolean,
    val error: String?,
)

internal object BridgeJson {
    /** Les capacités du moteur Android (`AudioBridgeCapabilities`). */
    private val CODECS = listOf("flac", "alac", "opus", "vorbis", "aac", "mp3", "wav")

    fun parse(argsJson: String): JSONObject = if (argsJson.isBlank()) JSONObject() else JSONObject(argsJson)

    fun start(o: JSONObject): BridgeStart {
        val headers = mutableMapOf<String, String>()
        o.optJSONObject("headers")?.let { h -> h.keys().forEach { key -> h.stringOrNull(key)?.let { headers[key] = it } } }
        return BridgeStart(
            serverOrigin = o.stringOrNull("serverOrigin") ?: "",
            headers = headers,
            volume = o.doubleOrNull("volume") ?: 1.0,
            muted = o.optBoolean("muted", false),
            replayGain = o.stringOrNull("replayGain") ?: "off",
        )
    }

    fun track(o: JSONObject?): BridgeTrack? {
        if (o == null) return null
        val key = o.stringOrNull("trackKey") ?: return null
        val meta = o.optJSONObject("meta")?.let { m ->
            BridgeMeta(m.stringOrNull("title") ?: "", m.stringOrNull("artist"), m.stringOrNull("album"), m.stringOrNull("artworkUrl"))
        }
        return BridgeTrack(key, o.stringOrNull("albumKey"), o.longOrNull("durationMs"), meta)
    }

    fun source(o: JSONObject?): BridgeSource? {
        if (o == null) return null
        val url = o.stringOrNull("url") ?: return null
        val rg = o.optJSONObject("replayGain")?.let { r ->
            BridgeReplayGain(r.doubleOrNull("trackGainDb"), r.doubleOrNull("trackPeak"), r.doubleOrNull("albumGainDb"), r.doubleOrNull("albumPeak"))
        }
        return BridgeSource(
            url, o.stringOrNull("origin") ?: "library", o.longOrNull("durationMs"), rg,
            direct = o.stringOrNull("open") == "direct",
            fallbackUrl = o.stringOrNull("fallbackUrl"),
        )
    }

    fun capabilities(): String = JSONObject()
        .put("engine", "media3")
        .put("gapless", true)
        .put("exclusiveOutput", false)
        .put("replayGain", true)
        .put("codecs", JSONArray(CODECS))
        .put("hotSwap", false)
        .toString()

    fun outputs(): String = JSONArray()
        .put(JSONObject().put("id", "default").put("name", "").put("exclusiveCapable", false))
        .toString()

    fun stateEvent(s: BridgeState, at: Long): String {
        val state = JSONObject()
            .put("status", s.status)
            .put("trackKey", s.trackKey.orNull())
            .put("positionMs", s.positionMs)
            .put("durationMs", s.durationMs ?: JSONObject.NULL)
            .put("volume", s.volume)
            .put("muted", s.muted)
            .put("format", JSONObject.NULL)
            .put("output", JSONObject().put("deviceId", JSONObject.NULL).put("exclusive", false))
            .put("error", s.error.orNull())
        return JSONObject().put("type", "state").put("state", state).put("at", at).toString()
    }

    fun advancedEvent(fromKey: String?, toKey: String?): String =
        JSONObject().put("type", "advanced").put("fromKey", fromKey.orNull()).put("toKey", toKey.orNull()).toString()

    fun swappedEvent(trackKey: String, origin: String): String =
        JSONObject().put("type", "swapped").put("trackKey", trackKey).put("origin", origin).toString()

    fun remoteEvent(command: String): String = JSONObject().put("type", "remote").put("command", command).toString()

    // `put(clé, null)` RETIRE la clé : un champ nul du contrat s'écrit `JSONObject.NULL`.
    private fun String?.orNull(): Any = this ?: JSONObject.NULL
}

// `optString` rend « null » (la chaîne) pour un JSON nul : on lit la nullité d'abord.
internal fun JSONObject.stringOrNull(key: String): String? = if (!has(key) || isNull(key)) null else optString(key)

internal fun JSONObject.doubleOrNull(key: String): Double? =
    if (!has(key) || isNull(key)) null else optDouble(key).takeIf { it.isFinite() }

internal fun JSONObject.longOrNull(key: String): Long? = doubleOrNull(key)?.toLong()
