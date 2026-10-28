import Foundation

/// Ce que le pont transporte, lu depuis le JSON de la page (`audioBridgeContract.ts`) : seulement les champs
/// dont le natif a besoin.
struct BridgeTrackMeta {
  let title: String
  let artist: String?
  let album: String?
  let artworkUrl: String?
}

struct BridgeTrack {
  let key: String
  let durationMs: Double?
  let meta: BridgeTrackMeta?

  init?(_ raw: Any?) {
    guard let dict = raw as? [String: Any], let key = dict["trackKey"] as? String else { return nil }
    self.key = key
    durationMs = (dict["durationMs"] as? NSNumber)?.doubleValue
    if let meta = dict["meta"] as? [String: Any], let title = meta["title"] as? String {
      self.meta = BridgeTrackMeta(
        title: title, artist: meta["artist"] as? String, album: meta["album"] as? String,
        artworkUrl: meta["artworkUrl"] as? String)
    } else {
      meta = nil
    }
  }
}

struct BridgeReplayGain {
  let trackGainDb: Double?
  let trackPeak: Double?
  let albumGainDb: Double?
  let albumPeak: Double?

  /// Le gain LINÉAIRE selon le mode : `album` et `auto` préfèrent celui de l'album, borné par la crête.
  func linear(mode: String) -> Double {
    if mode == "off" { return 1 }
    let preferAlbum = mode == "album" || mode == "auto"
    let db = (preferAlbum ? albumGainDb : nil) ?? trackGainDb
    let peak = (preferAlbum && albumGainDb != nil ? albumPeak : trackPeak) ?? 0
    guard let db else { return 1 }
    var gain = pow(10, db / 20)
    if peak > 0 { gain = min(gain, 1 / peak) }
    return min(3, max(0, gain))
  }
}

struct BridgeSource {
  let url: String
  let origin: String
  let durationMs: Double?
  let replayGain: BridgeReplayGain?
  /// `url` est un flux DIRECT (requêtes déléguées, jugé par la page) : ouvert SANS les en-têtes du serveur.
  let direct: Bool
  /// Le repli du flux direct : l'adresse du serveur (`direct=failed`), lue à son premier échec.
  let fallbackUrl: String?

  init?(_ raw: Any?) {
    guard let dict = raw as? [String: Any], let url = dict["url"] as? String else { return nil }
    self.url = url
    origin = dict["origin"] as? String ?? "library"
    durationMs = (dict["durationMs"] as? NSNumber)?.doubleValue
    direct = (dict["open"] as? String) == "direct"
    fallbackUrl = dict["fallbackUrl"] as? String
    if let rg = dict["replayGain"] as? [String: Any] {
      replayGain = BridgeReplayGain(
        trackGainDb: (rg["trackGainDb"] as? NSNumber)?.doubleValue, trackPeak: (rg["trackPeak"] as? NSNumber)?.doubleValue,
        albumGainDb: (rg["albumGainDb"] as? NSNumber)?.doubleValue, albumPeak: (rg["albumPeak"] as? NSNumber)?.doubleValue)
    } else {
      replayGain = nil
    }
  }

  private init(url: String, origin: String, durationMs: Double?, replayGain: BridgeReplayGain?) {
    self.url = url
    self.origin = origin
    self.durationMs = durationMs
    self.replayGain = replayGain
    direct = false
    fallbackUrl = nil
  }

  /// La même source, lue par le serveur (le repli d'un flux direct) ; `nil` sans repli.
  func serverFallback() -> BridgeSource? {
    guard direct, let fallbackUrl else { return nil }
    return BridgeSource(url: fallbackUrl, origin: origin, durationMs: durationMs, replayGain: replayGain)
  }
}

/// Un titre tel que le moteur le tient : son titre, sa source, et — pour le suivant — le fondu décidé par la page.
struct LoadedTrack {
  let track: BridgeTrack
  let source: BridgeSource
  var crossfadeMs: Double = 0

  var durationMs: Double? { source.durationMs ?? track.durationMs }
  /// Le suivant s'ouvre sur la platine arrière : un fondu, ou un flux direct (jamais ajouté à la liste de mpv).
  var opensOnBackDeck: Bool { crossfadeMs > 0 || source.direct }
}

enum BridgeJson {
  static func parse(_ json: String) -> [String: Any] {
    guard let data = json.data(using: .utf8),
          let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
    return value
  }

  static func string(_ value: Any) -> String {
    guard JSONSerialization.isValidJSONObject(value) || value is NSNull,
          let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]) else { return "" }
    return String(data: data, encoding: .utf8) ?? ""
  }
}
