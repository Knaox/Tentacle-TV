// Liste les fenêtres d'un processus (CGWindowList), en JSON sur la sortie.
//   windows <pid>
// Lu par le banc pour trouver le numéro de fenêtre à passer à `screencapture -l`
// et pour compter les fenêtres réelles (la fenêtre Metal de mpv, le PiP).
import CoreGraphics
import Foundation

let pid = Int(CommandLine.arguments.dropFirst().first ?? "") ?? -1
let all = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
var out: [[String: Any]] = []
for w in all where (w[kCGWindowOwnerPID as String] as? Int) == pid {
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  out.append([
    "id": w[kCGWindowNumber as String] as? Int ?? 0,
    "layer": w[kCGWindowLayer as String] as? Int ?? 0,
    "name": w[kCGWindowName as String] as? String ?? "",
    "onscreen": w[kCGWindowIsOnscreen as String] as? Bool ?? false,
    "alpha": w[kCGWindowAlpha as String] as? Double ?? 1,
    "x": b["X"] ?? 0, "y": b["Y"] ?? 0, "width": b["Width"] ?? 0, "height": b["Height"] ?? 0,
  ])
}
let data = try JSONSerialization.data(withJSONObject: out, options: [])
FileHandle.standardOutput.write(data)
