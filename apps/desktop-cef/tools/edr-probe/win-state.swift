// win-state — sonde EXTERNE de la fenêtre d'une app : ce que le serveur de fenêtres affiche
// vraiment (bornes, couche, écran), sans rien demander à l'app ni aucune permission (les
// bornes sont publiques, seuls les titres exigeraient l'enregistrement d'écran).
//
//   swift tools/edr-probe/win-state.swift <pid>
// Sortie : une ligne JSON {"screen":{w,h,safeTop},"windows":[{w,h,x,y,layer,onscreen}],"fullscreen":bool}
// « fullscreen » = une fenêtre de couche 0 du pid couvre exactement l'écran principal (points),
// sous l'encoche s'il y en a une : macOS y range le plein écran natif sous la barre des menus
// (mesuré 04/11 : fenêtre 1512×949 à y=33 sur un écran 1512×982 ; safeAreaInsets.top = 32,
// barre des menus = frame.maxY − visibleFrame.maxY = 33). « safeTop » = cette marge (0 sans encoche).
import AppKit

guard CommandLine.arguments.count > 1, let pid = Int32(CommandLine.arguments[1]) else {
    FileHandle.standardError.write("usage: win-state <pid>\n".data(using: .utf8)!)
    exit(2)
}
let main = NSScreen.screens.first
let screen = main?.frame ?? .zero
let notch = Double(main?.safeAreaInsets.top ?? 0) > 0
let menuBar = Double((main?.frame.maxY ?? 0) - (main?.visibleFrame.maxY ?? 0))
let safeTop = notch ? max(menuBar, Double(main?.safeAreaInsets.top ?? 0)) : 0
let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
var windows: [[String: Any]] = []
var fullscreen = false
for w in info where (w[kCGWindowOwnerPID as String] as? Int32) == pid {
    guard let b = w[kCGWindowBounds as String] as? [String: Double] else { continue }
    let layer = w[kCGWindowLayer as String] as? Int ?? -1
    let (x, y, wd, ht) = (b["X"] ?? 0, b["Y"] ?? 0, b["Width"] ?? 0, b["Height"] ?? 0)
    // Les fenêtres minuscules (barres d'outils cachées, ombres) ne comptent pas.
    if wd < 50 || ht < 50 { continue }
    windows.append(["x": x, "y": y, "w": wd, "h": ht, "layer": layer,
                    "onscreen": w[kCGWindowIsOnscreen as String] as? Bool ?? false])
    if layer == 0 && x == 0 && y == safeTop && wd == screen.width && ht == screen.height - safeTop { fullscreen = true }
}
let out: [String: Any] = ["screen": ["w": screen.width, "h": screen.height, "safeTop": safeTop],
                          "windows": windows, "fullscreen": fullscreen]
let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
