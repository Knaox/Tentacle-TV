// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// options alignées sur le lecteur de bureau, une seule police de repli.
import Foundation
import MPVKit

extension MpvRenderer {
  /// Options posées AVANT `mpv_initialize`, dans un ordre qui compte :
  /// `avfoundation-composite-osd` doit suivre immédiatement `vo`, avant tout
  /// `hwdec` (mesuré par Streamyfin : ailleurs, l'app se fige en quittant le
  /// lecteur). Le reste est tolérant : une option inconnue de cette build de
  /// mpv est journalisée, jamais fatale.
  func applyInitOptions(_ handle: OpaquePointer) {
    // 1. La couche d'affichage et le pilote vidéo.
    var layerPointer = Int64(Int(bitPattern: Unmanaged.passUnretained(displayLayer).toOpaque()))
    checkError(mpv_set_option(handle, "wid", MPV_FORMAT_INT64, &layerPointer))
    setInitOption(handle, "vo", "avfoundation")

    // 2. Sous-titres composités dans l'image (visibles en image dans l'image)
    //    et décodage matériel — sauf au simulateur, qui n'a pas VideoToolbox
    //    et dont la composition casse le rendu des sous-titres.
    #if targetEnvironment(simulator)
    setInitOption(handle, "avfoundation-composite-osd", "no")
    configuredHwdec = "no"
    #else
    setInitOption(handle, "avfoundation-composite-osd", "yes")
    configuredHwdec = "videotoolbox"
    #endif
    setInitOption(handle, "hwdec", configuredHwdec)
    // VideoToolbox ne sert que ces codecs aux apps tierces : VP9 n'est pas
    // enregistré par FFmpeg sur iOS, MPEG-2 et DivX restent logiciels (légers).
    setInitOption(handle, "hwdec-codecs", "h264,hevc,av1,prores")
    setInitOption(handle, "hwdec-software-fallback", "yes")

    // 3. Son : audiounit, PCM multicanal, horloge matérielle stable.
    setInitOption(handle, "ao", "audiounit")

    for (name, value) in Self.baseOptions {
      setInitOption(handle, name, value)
    }
    setupTlsTrust(handle)
    setupSubtitleFonts(handle)
    #if DEBUG
    applyDeveloperOverrides(handle)
    #endif
  }

  #if DEBUG
  /// Développement seulement : `TENTACLE_MPV_OPTS="vd-lavc-threads=1;hwdec=no"`
  /// dans l'environnement du processus (au simulateur, préfixe
  /// `SIMCTL_CHILD_`) pose des options d'initialisation en plus, pour isoler
  /// un plantage sans reconstruire. Le même levier que `TENTACLE_VIDEO_MONTAGE`
  /// au bureau ; absent des builds Release.
  func applyDeveloperOverrides(_ handle: OpaquePointer) {
    guard let raw = ProcessInfo.processInfo.environment["TENTACLE_MPV_OPTS"], !raw.isEmpty else { return }
    for pair in raw.split(separator: ";") {
      let parts = pair.split(separator: "=", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespaces) }
      guard parts.count == 2, !parts[0].isEmpty else { continue }
      MpvLogger.shared.log("option de développement : \(parts[0])=\(parts[1])", type: "Info")
      setInitOption(handle, parts[0], parts[1])
    }
  }
  #endif

  /// Une option d'initialisation ; le refus est journalisé (même règle que le bureau).
  func setInitOption(_ handle: OpaquePointer, _ name: String, _ value: String) {
    let status = mpv_set_option_string(handle, name, value)
    if status < 0 {
      MpvLogger.shared.log(
        "option refusée (\(String(cString: mpv_error_string(status)))) : \(name)=\(value)", type: "Warn")
    }
  }

  /// Le vocabulaire commun avec le lecteur de bureau (`mpvRuntime.ts`,
  /// `mpvOptions.ts`), aux tailles mémoire d'un téléphone.
  static let baseOptions: [(String, String)] = [
    // Fin de fichier : garder la dernière image, l'app décide de la suite.
    ("keep-open", "yes"),
    ("idle", "yes"),
    // Sources entrelacées (MPEG-2 TS) : mpv désentrelace quand le flux le dit.
    ("deinterlace", "auto"),

    // Cache : la règle « 30 s de pré-tampon » de CLAUDE.md, plafonnée à
    // 256 Mio — 512 Mio comme au bureau n'ont pas leur place sur un téléphone.
    ("cache", "yes"),
    ("demuxer-readahead-secs", "30"),
    ("demuxer-max-bytes", "256MiB"),
    ("demuxer-max-back-bytes", "50MiB"),
    ("cache-pause-initial", "yes"),
    ("cache-pause-wait", "10"),
    ("network-timeout", "30"),
    // La dernière valeur contient une virgule, le séparateur de la liste :
    // `\,` n'est pas un échappement pour mpv (mesuré : « Could not set
    // AVOption 5xx,… ») et `-append` est refusé par mpv_set_option_string
    // (mesuré sur Android : -5 ; ici le refus passait par le journal). La
    // forme `%n%` de mpv — longueur, puis la chaîne — la protège : vérifié
    // avec un mpv de bureau, FFmpeg retente bien sur un 400.
    ("stream-lavf-o",
     "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=5,reconnect_max_retries=8,reconnect_on_http_error=%7%4xx,5xx"),
    ("demuxer-lavf-o", "probesize=10000000,analyzeduration=10000000"),
    // fetch vérifie les certificats : mpv aussi — avec les racines de
    // `setupTlsTrust`, sans lesquelles ce `yes` refuse TOUT serveur https.
    ("tls-verify", "yes"),

    // Sous-titres : on ajoute les externes nous-mêmes ; jamais de
    // `sub-ass-override=force` — les styles ASS sont respectés.
    ("sub-auto", "no"),
    ("sub-scale-with-window", "no"),
    ("sub-use-margins", "no"),
    ("subs-fallback", "yes"),
    ("sub-vsfilter-bidi-compat", "yes"),

    // Aucun script (raison : `mpvOptions.ts` du bureau — LuaJIT et signature),
    // et rien de ce que mpv ferait de lui-même à l'écran.
    ("load-scripts", "no"),
    ("scripts", ""),
    ("load-auto-profiles", "no"),
    ("load-osd-console", "no"),
    ("load-stats-overlay", "no"),
    ("load-select", "no"),
    ("load-positioning", "no"),
    ("load-commands", "no"),
    ("ytdl", "no"),
    ("osc", "no"),
    ("osd-level", "0"),
    ("osd-bar", "no"),
    ("input-default-bindings", "no"),
    ("input-vo-keyboard", "no"),

    // Identité.
    ("user-agent", "Tentacle TV Mobile"),
    ("audio-client-name", "Tentacle TV"),
    ("force-media-title", "Tentacle TV"),
  ]

  // MARK: - Racines de confiance TLS

  /// Le FFmpeg de MPVKit parle GnuTLS, compilé en croisé sans aucun magasin
  /// de confiance (`--without-p11-kit`, pas de `--with-default-trust-store-file`,
  /// et la détection automatique de GnuTLS ne joue qu'en compilation native) :
  /// `gnutls_certificate_set_x509_system_trust` ne fournit rien sur iOS, et
  /// `tls-verify=yes` refuse alors tout certificat, même valide. Le paquet de
  /// racines Mozilla du module (`Resources/mpv/cacert.pem`, copié à la racine
  /// du bundle) est donné en `tls-ca-file` — le même fichier qu'Android. Il se
  /// lit dans le bundle à chaque démarrage : rien à copier ni à relier.
  func setupTlsTrust(_ handle: OpaquePointer) {
    guard let bundleFile = Bundle.main.url(forResource: "cacert", withExtension: "pem") else {
      MpvLogger.shared.log("cacert.pem absent du bundle : tls-verify refusera tout serveur https", type: "Warn")
      return
    }
    setInitOption(handle, "tls-ca-file", bundleFile.path)
  }

  // MARK: - Police de repli

  /// libass résout chaque glyphe dans cet ordre : la famille demandée par le
  /// style ASS, puis `--sub-font`, puis le fournisseur système (CoreText), puis
  /// `subfont.ttf` du dossier de configuration, pris aveuglément. On remplit
  /// les deux emplacements qui ne dépendent pas de CoreText avec une police
  /// latine légère : `<config-dir>/fonts/` (base de polices de libass) et
  /// `<config-dir>/subfont.ttf`. Le CJK reste à CoreText (PingFang) ; les
  /// polices jointes d'un MKV sont lues dans le fichier, indépendamment.
  func setupSubtitleFonts(_ handle: OpaquePointer) {
    guard let configDir = Self.mpvConfigDirectory() else { return }
    let fileManager = FileManager.default
    let fontsDir = configDir.appendingPathComponent("fonts", isDirectory: true)
    do {
      try fileManager.createDirectory(at: fontsDir, withIntermediateDirectories: true)
    } catch {
      MpvLogger.shared.log("dossier de polices impossible : \(error.localizedDescription)", type: "Warn")
      return
    }
    // Des liens, pas des copies : le lien est rafraîchi quand une mise à jour
    // de l'app déplace le bundle.
    Self.linkFont(named: Self.subtitleFontResource, at: fontsDir.appendingPathComponent(Self.subtitleFontResource))
    Self.linkFont(named: Self.subtitleFontResource, at: configDir.appendingPathComponent("subfont.ttf"))

    setInitOption(handle, "config", "yes")
    setInitOption(handle, "config-dir", configDir.path)
    setInitOption(handle, "sub-font", Self.subtitleFontFamily)
  }

  static let subtitleFontResource = "NotoSans-Regular.ttf"
  static let subtitleFontFamily = "Noto Sans"

  /// Dossier inscriptible et hors sauvegarde, donné à mpv en `--config-dir`.
  static func mpvConfigDirectory() -> URL? {
    do {
      let root = try FileManager.default.url(
        for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let dir = root.appendingPathComponent("mpv", isDirectory: true)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      return dir
    } catch {
      MpvLogger.shared.log("dossier mpv impossible : \(error.localizedDescription)", type: "Warn")
      return nil
    }
  }

  /// Relie une police du bundle dans le dossier de polices isolé de mpv.
  static func linkFont(named resource: String, at destination: URL) {
    let fileManager = FileManager.default
    let name = (resource as NSString).deletingPathExtension
    let ext = (resource as NSString).pathExtension
    guard let source = Bundle.main.url(forResource: name, withExtension: ext) else {
      MpvLogger.shared.log("police \(resource) absente du bundle", type: "Warn")
      return
    }
    let currentTarget = try? fileManager.destinationOfSymbolicLink(atPath: destination.path)
    if let currentTarget,
       URL(fileURLWithPath: currentTarget).standardizedFileURL == source.standardizedFileURL {
      return
    }
    do {
      if currentTarget != nil || fileManager.fileExists(atPath: destination.path) {
        try fileManager.removeItem(at: destination)
      }
      try fileManager.createSymbolicLink(at: destination, withDestinationURL: source)
    } catch {
      MpvLogger.shared.log("lien de police \(resource) impossible : \(error.localizedDescription)", type: "Warn")
    }
  }
}
