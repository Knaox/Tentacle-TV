import Foundation

/**
 * Lecture — et retouche minimale — de l'arbre de boîtes d'un MP4.
 *
 * Deux besoins, tous deux payés par un défaut mesuré :
 *
 * 1. Un fichier Allégé peut arriver SANS `moov` : le transcodage progressif de
 *    Jellyfin écrit son index en dernier, et la réponse s'est parfois achevée
 *    avant. Aucune finalisation ne répare cela — il faut le retélécharger, et
 *    le savoir avant de tenter un export qui échouera trois fois.
 * 2. En copiant du HEVC dans un MP4, ffmpeg nomme l'entrée d'échantillon
 *    `hev1`. AVFoundation n'ouvre le HEVC que sous `hvc1` : la piste existe, le
 *    son sort, et l'image reste NOIRE — sans la moindre erreur. Les deux formes
 *    ne diffèrent que par la place des jeux de paramètres ; quand le `hvcC`
 *    porte déjà les siens, renommer ces quatre octets suffit, sans réencodage.
 *    C'est exactement ce que fait `ffmpeg -tag:v hvc1`.
 */

/// Ce que l'index d'un fichier permet d'en faire.
enum Mp4Index {
  /// Aucun `moov` : le fichier est amputé, rien ici ne le sauvera.
  case missing
  /// `moov` avec `mvex` : les échantillons vivent dans les `moof`, à remuxer.
  case fragmented
  /// `moov` complet : le fichier se lit tel quel.
  case indexed
}

enum Mp4Boxes {
  /// Taille maximale d'un `moov` chargé en mémoire (les index restent petits).
  private static let maxMoovBytes = 64 << 20

  // MARK: - Lecture de l'index

  static func index(of url: URL) -> Mp4Index {
    guard let handle = try? FileHandle(forReadingFrom: url) else { return .missing }
    defer { try? handle.close() }
    guard let moov = topLevelBox(named: "moov", in: handle) else { return .missing }
    guard let payload = read(handle, at: moov.contentOffset, length: moov.contentLength) else { return .missing }
    return child(named: "mvex", in: payload, from: 0, to: payload.count) == nil ? .indexed : .fragmented
  }

  // MARK: - `hev1` → `hvc1`

  /// Renomme les entrées HEVC qui peuvent l'être ; `true` si le fichier a changé.
  static func promoteHevcTag(at url: URL) -> Bool {
    guard let handle = try? FileHandle(forUpdating: url) else { return false }
    defer { try? handle.close() }
    guard let moov = topLevelBox(named: "moov", in: handle),
          let payload = read(handle, at: moov.contentOffset, length: moov.contentLength)
    else { return false }

    let offsets = hev1TypeOffsets(in: payload).map { moov.contentOffset + UInt64($0) }
    guard !offsets.isEmpty else { return false }
    for offset in offsets {
      do {
        try handle.seek(toOffset: offset)
        handle.write(Data("hvc1".utf8))
      } catch {
        return false
      }
    }
    try? handle.synchronize()
    return true
  }

  /// Les positions, dans le `moov`, du champ de type des entrées `hev1` promouvables.
  private static func hev1TypeOffsets(in moov: Data) -> [Int] {
    var found: [Int] = []
    forEachBox(in: moov, from: 0, to: moov.count) { trak in
      guard trak.type == "trak" else { return }
      guard let mdia = child(named: "mdia", in: moov, from: trak.contentStart, to: trak.end),
            let minf = child(named: "minf", in: moov, from: mdia.contentStart, to: mdia.end),
            let stbl = child(named: "stbl", in: moov, from: minf.contentStart, to: minf.end),
            let stsd = child(named: "stsd", in: moov, from: stbl.contentStart, to: stbl.end)
      else { return }
      // `stsd` est une FullBox : version et drapeaux, puis le nombre d'entrées.
      var cursor = stsd.contentStart + 8
      while cursor + 8 <= stsd.end {
        guard let entry = box(in: moov, at: cursor, limit: stsd.end) else { return }
        if entry.type == "hev1", hasParameterSets(in: moov, entry: entry) {
          found.append(cursor + 4)
        }
        cursor = entry.end
      }
    }
    return found
  }

  /// Le `hvcC` de cette entrée porte-t-il VPS, SPS et PPS hors bande ?
  private static func hasParameterSets(in data: Data, entry: Box) -> Bool {
    // En-tête (8) puis les 78 octets fixes d'une entrée d'échantillon visuelle.
    guard let hvcC = child(named: "hvcC", in: data, from: entry.start + 86, to: entry.end) else { return false }
    // `numOfArrays` clôt l'en-tête fixe du `hvcC`.
    var cursor = hvcC.contentStart + 22
    guard cursor < hvcC.end else { return false }
    let arrayCount = Int(data[index(data, cursor)])
    cursor += 1
    var kinds = Set<Int>()
    for _ in 0..<arrayCount {
      guard cursor + 3 <= hvcC.end else { return false }
      kinds.insert(Int(data[index(data, cursor)] & 0x3F))
      var units = Int(be16(data, cursor + 1))
      cursor += 3
      while units > 0 {
        guard cursor + 2 <= hvcC.end else { return false }
        cursor += 2 + Int(be16(data, cursor))
        units -= 1
      }
    }
    // 32 = VPS, 33 = SPS, 34 = PPS — les trois sont exigés par `hvc1`.
    return kinds.isSuperset(of: [32, 33, 34])
  }

  // MARK: - Parcours

  private struct Box {
    let type: String
    /// Début de l'en-tête, début du contenu, et première position APRÈS la boîte.
    let start: Int
    let contentStart: Int
    let end: Int
  }

  private struct FileBox {
    let contentOffset: UInt64
    let contentLength: Int
  }

  /// Parcourt les boîtes de premier niveau par leurs seuls en-têtes.
  private static func topLevelBox(named name: String, in handle: FileHandle) -> FileBox? {
    guard let size = try? handle.seekToEnd() else { return nil }
    var offset: UInt64 = 0
    while offset + 8 <= size {
      guard let header = read(handle, at: offset, length: 16), header.count >= 8 else { return nil }
      var boxSize = UInt64(be32(header, 0))
      var headerSize: UInt64 = 8
      if boxSize == 1 {
        guard header.count >= 16 else { return nil }
        boxSize = be64(header, 8)
        headerSize = 16
      } else if boxSize == 0 {
        boxSize = size - offset
      }
      guard boxSize >= headerSize, offset + boxSize <= size else { return nil }
      if type(header, 4) == name {
        let length = Int(boxSize - headerSize)
        return length > 0 && length <= maxMoovBytes ? FileBox(contentOffset: offset + headerSize, contentLength: length) : nil
      }
      offset += boxSize
    }
    return nil
  }

  private static func box(in data: Data, at start: Int, limit: Int) -> Box? {
    guard start + 8 <= limit else { return nil }
    var size = Int(be32(data, start))
    var headerSize = 8
    if size == 1 {
      guard start + 16 <= limit else { return nil }
      size = Int(be64(data, start + 8))
      headerSize = 16
    } else if size == 0 {
      size = limit - start
    }
    guard size >= headerSize, start + size <= limit else { return nil }
    return Box(type: type(data, start + 4), start: start, contentStart: start + headerSize, end: start + size)
  }

  private static func forEachBox(in data: Data, from: Int, to: Int, visit: (Box) -> Void) {
    var cursor = from
    while let current = box(in: data, at: cursor, limit: to) {
      visit(current)
      cursor = current.end
    }
  }

  private static func child(named name: String, in data: Data, from: Int, to: Int) -> Box? {
    var cursor = from
    while let current = box(in: data, at: cursor, limit: to) {
      if current.type == name { return current }
      cursor = current.end
    }
    return nil
  }

  // MARK: - Lecture brute

  private static func read(_ handle: FileHandle, at offset: UInt64, length: Int) -> Data? {
    do {
      try handle.seek(toOffset: offset)
      return try handle.read(upToCount: length)
    } catch {
      return nil
    }
  }

  /// `Data` tranché garde les indices de son parent : tout accès passe par ici.
  private static func index(_ data: Data, _ offset: Int) -> Data.Index {
    data.index(data.startIndex, offsetBy: offset)
  }

  private static func be16(_ data: Data, _ offset: Int) -> UInt16 {
    (UInt16(data[index(data, offset)]) << 8) | UInt16(data[index(data, offset + 1)])
  }

  private static func be32(_ data: Data, _ offset: Int) -> UInt32 {
    (0..<4).reduce(UInt32(0)) { ($0 << 8) | UInt32(data[index(data, offset + $1)]) }
  }

  private static func be64(_ data: Data, _ offset: Int) -> UInt64 {
    (0..<8).reduce(UInt64(0)) { ($0 << 8) | UInt64(data[index(data, offset + $1)]) }
  }

  private static func type(_ data: Data, _ offset: Int) -> String {
    String(bytes: (0..<4).map { data[index(data, offset + $0)] }, encoding: .isoLatin1) ?? ""
  }
}
