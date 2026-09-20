import Foundation

/// Un sous-titre externe à ajouter (`sub-add`) une fois le fichier chargé.
struct MpvExternalSubtitle {
  let url: String
  /// Sélectionner cette piste dès son ajout.
  let select: Bool
}

/// Ce que JS demande à `loadfile` : la source, ses en-têtes, la position de
/// départ et la sélection initiale des pistes. La sélection s'exprime en
/// `ff-index` — l'index ffprobe, celui que Jellyfin appelle `MediaStream.Index`
/// — jamais en identifiant mpv, qui n'existe qu'une fois le fichier chargé.
struct MpvLoadConfig {
  let url: URL
  var headers: [String: String]?
  var startPosition: Double?
  var externalSubtitles: [MpvExternalSubtitle]
  var initialAudioFfIndex: Int?
  /// `nil` : aucun sous-titre intégré au départ (les externes ont leur propre
  /// drapeau `select`).
  var initialSubtitleFfIndex: Int?
  /// Change pour forcer un rechargement de la MÊME URL (nouvel essai).
  var reloadToken: String?

  /// Lit le dictionnaire de la prop `source`. `nil` sans URL valable.
  static func parse(_ source: [String: Any]) -> MpvLoadConfig? {
    guard let urlString = source["url"] as? String, let url = URL(string: urlString) else {
      return nil
    }
    let externals: [MpvExternalSubtitle] =
      (source["externalSubtitles"] as? [[String: Any]])?.compactMap { entry in
        guard let subtitleUrl = entry["url"] as? String else { return nil }
        return MpvExternalSubtitle(url: subtitleUrl, select: (entry["select"] as? Bool) ?? false)
      } ?? []
    return MpvLoadConfig(
      url: url,
      headers: source["headers"] as? [String: String],
      startPosition: double(source["startPosition"]),
      externalSubtitles: externals,
      initialAudioFfIndex: integer(source["initialAudioFfIndex"]),
      initialSubtitleFfIndex: integer(source["initialSubtitleFfIndex"]),
      reloadToken: source["reloadToken"] as? String
    )
  }

  /// Deux demandes qui désignent la même lecture : même URL, même jeton.
  func isSameMedia(as other: MpvLoadConfig) -> Bool {
    url == other.url && reloadToken == other.reloadToken
  }

  private static func integer(_ value: Any?) -> Int? {
    if let intValue = value as? Int { return intValue }
    if let doubleValue = value as? Double, doubleValue.isFinite { return Int(exactly: doubleValue) }
    return nil
  }

  private static func double(_ value: Any?) -> Double? {
    if let doubleValue = value as? Double, doubleValue.isFinite { return doubleValue }
    if let intValue = value as? Int { return Double(intValue) }
    return nil
  }
}
