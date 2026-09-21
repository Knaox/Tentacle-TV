import Foundation

/// Ce que le JS transmet à `PrismBridge.start()` : la source, ses en-têtes et
/// les préférences. Tout est optionnel sauf l'URL — un dictionnaire incomplet
/// vaut un refus (`nil`), jamais un défaut silencieux qui ferait jouer le
/// mauvais fichier.
struct PrismSessionConfig: Sendable {
    /// Budget disque des segments par défaut : 1 Gio, celui de PrismCore. Il
    /// borne le disque, pas la seekabilité — un segment évincé est reproduit
    /// à la demande.
    static let defaultSegmentCacheBytes = 1 << 30

    let url: URL
    /// En-têtes d'auth Jellyfin (`X-Emby-Token`…). Indispensables quand l'URL
    /// passe par le proxy Tentacle, qui retire `api_key` de la query.
    let headers: [String: String]
    /// Langue de la piste audio que le master marque `DEFAULT` : la lecture
    /// démarre dans la bonne langue au lieu de commuter après coup.
    let preferredAudioLanguage: String?
    let segmentCacheBytes: Int?

    init?(_ dict: NSDictionary) {
        guard let raw = dict["url"] as? String, let url = URL(string: raw) else { return nil }
        self.url = url
        var headers: [String: String] = [:]
        if let given = dict["headers"] as? [String: Any] {
            for (key, value) in given {
                if let text = value as? String { headers[key] = text }
            }
        }
        self.headers = headers
        let language = (dict["preferredAudioLanguage"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.preferredAudioLanguage = (language?.isEmpty == false) ? language : nil
        if let bytes = dict["segmentCacheBytes"] as? NSNumber, bytes.intValue > 0 {
            self.segmentCacheBytes = bytes.intValue
        } else {
            self.segmentCacheBytes = nil
        }
    }
}

/// Une piste audio de la source telle que PrismCore la traite. `streamIndex`
/// est l'index FFmpeg du flux — le même que `MediaStream.Index` côté Jellyfin
/// (ffprobe). `delivery` : `streamCopy`, `bridged` (EAC3), `unavailable`…
struct PrismAudioTrack: Sendable {
    let streamIndex: Int
    let delivery: String
}

/// Une rendition sous-titre du master (`subsN/index.m3u8`), dans l'ordre où
/// AVPlayer la voit dans son groupe `legible`.
struct PrismSubtitleRendition: Sendable {
    let name: String
    let language: String?
    let uri: String
    let isForced: Bool
}

/// Ce que `start()` rend au JS.
struct PrismStartResult: Sendable {
    let url: URL
    let gen: Int
    /// `keyframeIndexCache`, `builtFromSource` (VOD planifié) ou `sequential`
    /// (EVENT : source sans index, premier visionnage — ou forme muxée pontée).
    let planOrigin: String
    let audioTracks: [PrismAudioTrack]
    let subtitleRenditions: [PrismSubtitleRendition]
    let durationSec: Double?
    /// Ce que l'écriture des critères d'affichage a donné :
    /// `willSwitch` / `wrote` / `alreadyActive` / `matchingDisabled` / `noWindow`.
    let displaySwitch: String?
    /// Le rapport de settle de la bascule HDR/DV, quand il y en a eu une.
    let displaySettle: String?
    let panelIsHDR: Bool?

    func asDictionary() -> [String: Any] {
        var out: [String: Any] = [
            "url": url.absoluteString,
            "gen": gen,
            "planOrigin": planOrigin,
            "audioTracks": audioTracks.map { ["streamIndex": $0.streamIndex, "delivery": $0.delivery] },
            "subtitleRenditions": subtitleRenditions.map { rendition -> [String: Any] in
                var entry: [String: Any] = ["name": rendition.name, "uri": rendition.uri, "isForced": rendition.isForced]
                if let language = rendition.language { entry["language"] = language }
                return entry
            },
        ]
        if let durationSec { out["durationSec"] = durationSec }
        if let displaySwitch { out["displaySwitch"] = displaySwitch }
        if let displaySettle { out["displaySettle"] = displaySettle }
        if let panelIsHDR { out["panelIsHDR"] = panelIsHDR }
        return out
    }
}
