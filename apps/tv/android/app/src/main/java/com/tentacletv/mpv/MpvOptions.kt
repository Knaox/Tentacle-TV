package com.tentacletv.mpv

import android.content.Context
import android.system.Os
import android.util.Log
import java.io.File

/**
 * Les options mpv du téléviseur, posées AVANT `initialize()`. mpv ne sert ici
 * qu'au transcodage — ExoPlayer est le moteur principal, il rend directement
 * sur la surface et garde le HDR natif. Le jeu d'options est celui d'avant, à
 * deux ajouts près venus du mobile (libmpv 1.0) : fontconfig persistant et les
 * certificats racine pour https.
 *
 * Noms de propriétés mpv : traversés par chaîne, jamais renommés.
 */
internal object MpvOptions {
    private const val TAG = "MpvPlayerView"

    private val BASE_OPTIONS: List<Pair<String, String>> = listOf(
        // Profil de performance (défaut de mpv-android)
        "profile" to "fast",
        // Sortie vidéo — config mpv-android officielle
        "vo" to "gpu",
        "gpu-context" to "android",
        "opengl-es" to "yes",
        "hwdec" to "mediacodec,mediacodec-copy",
        "hwdec-codecs" to "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1",
        "vd-lavc-dr" to "yes",
        "vd-lavc-film-grain" to "cpu",
        "keepaspect" to "yes",
        // Sortie audio — passthrough des codecs surround, PCM en repli
        "ao" to "audiotrack,opensles",
        "audio-channels" to "auto-safe",
        "audio-spdif" to "ac3,eac3,truehd,dts,dts-hd",
        "audio-stream-silence" to "yes",
        // Cache / démuxeur (officiel : 64 Mio chacun)
        "demuxer-max-bytes" to "${64 * 1024 * 1024}",
        "demuxer-max-back-bytes" to "${64 * 1024 * 1024}",
        // Sous-titres — les polices système restent indiquées, fontconfig (ci-dessous)
        // les indexe une fois pour toutes au lieu de reparcourir /system/fonts.
        "sub-auto" to "no",
        "sub-visibility" to "yes",
        "sub-fonts-dir" to "/system/fonts",
        "osd-fonts-dir" to "/system/fonts",
        "sub-font" to "Roboto",
        "sub-font-size" to "48",
        "sub-color" to "#FFFFFFFF",
        "sub-border-color" to "#FF000000",
        "sub-border-size" to "3",
        "sub-shadow-offset" to "2",
        "sub-use-margins" to "yes",
        "sub-ass-override" to "force",
        // Pas d'OSD (l'overlay React Native fait le travail)
        "osc" to "no",
        "osd-level" to "0",
    )

    fun apply(handle: MPVLib, context: Context) {
        // Dossier de configuration et fontconfig (nouveau dans libmpv 1.0) dans le
        // stockage interne : l'index des polices persiste entre les lancements au
        // lieu de reparcourir /system/fonts à chaque sous-titre (1 à 2 s, 10 à
        // 30 Mio, mesuré par Streamyfin).
        val mpvDir = File(context.filesDir, "mpv")
        if (!mpvDir.exists()) mpvDir.mkdirs()
        try {
            Os.setenv("XDG_CACHE_HOME", context.cacheDir.absolutePath, true)
            Os.setenv("XDG_CONFIG_HOME", context.filesDir.absolutePath, true)
            Os.setenv("HOME", context.filesDir.absolutePath, true)
        } catch (e: Exception) {
            Log.w(TAG, "environnement fontconfig : ${e.message}")
        }
        handle.setOptionString("config", "yes")
        handle.setOptionString("config-dir", mpvDir.path)
        // TLS : le FFmpeg de libmpv-android parle mbedTLS, qui ne connaît aucun
        // magasin système. `tls-ca-file` SEULEMENT — `tls-verify` reste à son
        // défaut, pour que les serveurs auto-signés qui marchent aujourd'hui
        // continuent de marcher.
        installCaBundle(context, mpvDir)?.let { handle.setOptionString("tls-ca-file", it.path) }
        for ((name, value) in BASE_OPTIONS) {
            val status = handle.setOptionString(name, value)
            if (status < 0) Log.w(TAG, "option refusée ($status) : $name=$value")
        }
    }

    /** Le paquet de certificats racine de Mozilla (asset `mpv/cacert.pem`, même
     *  fichier que le mobile), copié une fois dans le dossier mpv. */
    private fun installCaBundle(context: Context, mpvDir: File): File? {
        val target = File(mpvDir, "cacert.pem")
        try {
            context.assets.open("mpv/cacert.pem").use { input ->
                val bytes = input.readBytes()
                if (!target.exists() || target.length() != bytes.size.toLong()) {
                    val temp = File(mpvDir, "cacert.pem.tmp")
                    temp.writeBytes(bytes)
                    if (!temp.renameTo(target)) target.writeBytes(bytes)
                }
            }
            return target
        } catch (e: Exception) {
            Log.w(TAG, "certificats racine indisponibles : ${e.message}")
            return null
        }
    }
}
