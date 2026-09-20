// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLayerRenderer.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : options alignées sur iOS et le bureau.
package expo.modules.mpvplayer

import android.os.Build
import android.system.Os
import android.util.Log
import java.io.File

/**
 * Vrai seulement sur l'émulateur : son MediaCodec (goldfish/ranchu) ne sait
 * pas lier une surface de sortie — le HEVC échoue proprement, le H.264
 * « s'ouvre » et fige le cœur. Décodage logiciel forcé. Seuls des signaux
 * exclusifs à QEMU/SDK sont testés : un vrai appareil ne peut pas correspondre.
 */
internal fun isEmulator(): Boolean {
    val hardware = Build.HARDWARE.lowercase()
    if (hardware == "goldfish" || hardware == "ranchu") return true
    val product = Build.PRODUCT
    if (product == "sdk" || product.startsWith("sdk_")) return true
    val fingerprint = Build.FINGERPRINT
    return fingerprint.startsWith("generic") || fingerprint.contains("emulator", ignoreCase = true)
}

/** Les options communes au bureau et à iOS (`mpvRuntime.ts`, `MpvRenderer+Options.swift`). */
private val BASE_OPTIONS: List<Pair<String, String>> = listOf(
    "keep-open" to "always",
    "deinterlace" to "auto",
    // Cache : 30 s de pré-tampon, plafonné pour un téléphone.
    "cache" to "yes",
    "demuxer-readahead-secs" to "30",
    "demuxer-max-bytes" to "256MiB",
    "demuxer-max-back-bytes" to "50MiB",
    "cache-pause-initial" to "yes",
    "cache-pause-wait" to "10",
    "network-timeout" to "30",
    "stream-lavf-o" to "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=5,reconnect_max_retries=8",
    // La valeur contient une virgule, le séparateur de la liste : `-append` ajoute UN couple sans le redécouper.
    "stream-lavf-o-append" to "reconnect_on_http_error=4xx,5xx",
    "demuxer-lavf-o" to "probesize=10000000,analyzeduration=10000000",
    "tls-verify" to "yes",
    // Sous-titres : on ajoute les externes nous-mêmes ; styles ASS respectés
    // (jamais `sub-ass-override=force`). Polices système par fontconfig.
    "sub-auto" to "no",
    "sub-scale-with-window" to "no",
    "sub-use-margins" to "no",
    "subs-fallback" to "yes",
    "sub-vsfilter-bidi-compat" to "yes",
    "sub-font" to "sans-serif",
    // Aucun script, rien de ce que mpv ferait de lui-même à l'écran.
    "load-scripts" to "no",
    "scripts" to "",
    "load-auto-profiles" to "no",
    "load-osd-console" to "no",
    "load-stats-overlay" to "no",
    "load-select" to "no",
    "load-positioning" to "no",
    "load-commands" to "no",
    "ytdl" to "no",
    "osc" to "no",
    "osd-level" to "0",
    "osd-bar" to "no",
    "input-default-bindings" to "no",
    "input-vo-keyboard" to "no",
    "user-agent" to "Tentacle TV Mobile",
    "audio-client-name" to "Tentacle TV",
    "force-media-title" to "Tentacle TV",
)

/**
 * Options posées AVANT `init()`. Le rendu passe par gpu-next sur le contexte
 * Android (OpenGL ES) ; le HDR y est tone-mappé (libplacebo sans Vulkan) — ce
 * moteur ne sert qu'à ce qu'ExoPlayer ne lit pas, en SDR dans la pratique.
 */
internal fun MpvRenderer.applyInitOptions(handle: MPVLib) {
    // Dossier de configuration et fontconfig (nouveau dans libmpv 1.0) sur des
    // dossiers inscriptibles : l'index des polices persiste entre les lancements
    // au lieu de reparcourir /system/fonts à chaque sous-titre (1 à 2 s, 10 à
    // 30 Mio, mesuré par Streamyfin).
    val mpvDir = File(context.getExternalFilesDir(null) ?: context.filesDir, "mpv")
    if (!mpvDir.exists()) mpvDir.mkdirs()
    try {
        val configDir = (context.getExternalFilesDir(null) ?: context.filesDir).absolutePath
        Os.setenv("XDG_CACHE_HOME", context.cacheDir.absolutePath, true)
        Os.setenv("XDG_CONFIG_HOME", configDir, true)
        Os.setenv("HOME", configDir, true)
    } catch (e: Exception) {
        Log.w(MpvRenderer.TAG, "environnement fontconfig : ${e.message}")
    }
    handle.setOptionString("config", "yes")
    handle.setOptionString("config-dir", mpvDir.path)

    handle.setOptionString("vo", "gpu-next")
    handle.setOptionString("gpu-context", "android")
    handle.setOptionString("opengl-es", "yes")
    handle.setOptionString("profile", "fast")
    handle.setOptionString("hwdec-codecs", "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1")
    // `mediacodec-copy` sur téléphone (le plus large) ; logiciel à l'émulateur.
    handle.setOptionString("hwdec", if (isEmulator()) "no" else "mediacodec-copy")
    handle.setOptionString("ao", "audiotrack,opensles")
    // La fenêtre n'existe qu'avec une surface : `force-window` passe à yes à l'attache.
    handle.setOptionString("force-window", "no")

    for ((name, value) in BASE_OPTIONS) {
        val status = handle.setOptionString(name, value)
        if (status < 0) Log.w(MpvRenderer.TAG, "option refusée ($status) : $name=$value")
    }
}

internal fun MpvRenderer.observeProperties(handle: MPVLib) {
    handle.observeProperty("duration", MPVLib.MPV_FORMAT_DOUBLE)
    handle.observeProperty("time-pos", MPVLib.MPV_FORMAT_DOUBLE)
    handle.observeProperty("pause", MPVLib.MPV_FORMAT_FLAG)
    handle.observeProperty("track-list/count", MPVLib.MPV_FORMAT_INT64)
    handle.observeProperty("paused-for-cache", MPVLib.MPV_FORMAT_FLAG)
    handle.observeProperty("demuxer-cache-duration", MPVLib.MPV_FORMAT_DOUBLE)
    handle.observeProperty("eof-reached", MPVLib.MPV_FORMAT_FLAG)
    handle.observeProperty("video-params/gamma", MPVLib.MPV_FORMAT_STRING)
}

/**
 * `http-header-fields` est une LISTE mpv : par l'interface des propriétés,
 * seule la forme « a: b,c: d » passe ; vider la liste, c'est écrire "".
 */
internal fun MpvRenderer.updateHttpHeaders(handle: MPVLib, headers: Map<String, String>?) {
    handle.setPropertyString("http-header-fields", "")
    if (headers.isNullOrEmpty()) return
    handle.setPropertyString("http-header-fields", headers.entries.joinToString(",") { "${it.key}: ${it.value}" })
}
