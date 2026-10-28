package expo.modules.octaveaudio

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.ResolvingDataSource
import java.io.IOException
import java.util.Locale

/**
 * Ce que le moteur a le droit d'ouvrir : l'origine du serveur Tentacle
 * (`serverOrigin` d'`audio_engine_start`), avec ses en-têtes d'authentification,
 * les fichiers locaux (`file://`, copie gardée hors ligne), et les flux DIRECTS
 * (requêtes déléguées) : en https, SANS aucun en-tête, l'adresse exacte que la
 * page a jugée et dont le repli est du serveur. Rien d'autre.
 *
 * Les en-têtes ne sont posés QUE sur une requête de cette origine : le jeton ne
 * part jamais ailleurs. La règle est jouée deux fois — par le moteur avant de
 * poser un titre (`allows`, état `error` sinon) et par la source de données à
 * chaque ouverture (`resolver`, sur le fil de chargement d'ExoPlayer : d'où un
 * instantané immuable et `@Volatile`).
 */
internal object SourcePolicy {
    private class Origin(val scheme: String, val host: String, val port: Int, val headers: Map<String, String>)

    @Volatile
    private var origin: Origin? = null

    fun configure(serverOrigin: String, headers: Map<String, String>) {
        val uri = Uri.parse(serverOrigin)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        val host = uri.host?.lowercase(Locale.ROOT)
        origin = if (scheme == null || host == null || !isHttp(scheme)) null else Origin(scheme, host, portOf(uri), headers.toMap())
    }

    fun clear() {
        origin = null
    }

    /** Les flux directs admis (adresses exactes), les plus récents gardés. */
    @Volatile
    private var directUrls: Set<String> = emptySet()
    private const val MAX_DIRECT = 64

    /** Vrai pour une source que le moteur peut lire ; un flux direct admis est retenu pour la source de données. */
    fun allows(source: BridgeSource): Boolean {
        if (!source.direct) return allows(source.url)
        val fallback = source.fallbackUrl ?: return false
        if (Uri.parse(source.url).scheme?.lowercase(Locale.ROOT) != "https" || !allows(fallback)) return false
        synchronized(this) {
            val kept = LinkedHashSet(directUrls)
            kept.remove(source.url)
            kept.add(source.url)
            while (kept.size > MAX_DIRECT) kept.remove(kept.first())
            directUrls = kept
        }
        return true
    }

    /** Vrai pour une adresse que le moteur peut lire (même origine que le serveur, ou fichier local). */
    fun allows(url: String): Boolean {
        val uri = Uri.parse(url)
        return when (uri.scheme?.lowercase(Locale.ROOT)) {
            "file" -> true
            "http", "https" -> sameOrigin(uri, origin)
            else -> false
        }
    }

    /** Pour `ResolvingDataSource` : en-têtes sur l'origine du serveur, refus de toute autre adresse réseau. */
    @OptIn(UnstableApi::class)
    val resolver = ResolvingDataSource.Resolver { spec: DataSpec ->
        val current = origin
        val scheme = spec.uri.scheme?.lowercase(Locale.ROOT)
        // Un flux direct : tel quel, aucun en-tête (le jeton ne part jamais chez son hôte).
        if (scheme == "https" && spec.uri.toString() in directUrls) return@Resolver spec
        when (scheme) {
            "http", "https" -> {
                if (!sameOrigin(spec.uri, current)) throw IOException("octave-audio: origine refusée (${spec.uri.host})")
                spec.withAdditionalHeaders(current!!.headers)
            }
            else -> spec
        }
    }

    private fun sameOrigin(uri: Uri, o: Origin?): Boolean {
        if (o == null) return false
        val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return false
        val host = uri.host?.lowercase(Locale.ROOT) ?: return false
        return scheme == o.scheme && host == o.host && portOf(uri) == o.port
    }

    private fun isHttp(scheme: String) = scheme == "http" || scheme == "https"

    /** Le port EFFECTIF (celui du schéma quand l'adresse n'en dit pas) : `https://h` = `https://h:443`. */
    private fun portOf(uri: Uri): Int = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
