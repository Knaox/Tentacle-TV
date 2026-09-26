import XCTest
import Network
import UIKit
import ObjectiveC

/// Agent de pilotage : se connecte au Mac en TCP, exécute des commandes de
/// télécommande (XCUIRemote) et renvoie captures d'écran et arbre d'accessibilité.
/// Protocole : Mac → agent, une ligne JSON par commande `{"id":1,"a":"down"}` ;
/// agent → Mac, une ligne JSON d'en-tête `{"id":1,"len":N,...}` suivie de N octets.
final class AgentUITests: XCTestCase {

    override class func setUp() {
        super.setUp()
        disableQuiescence()
    }

    func testAgent() throws {
        continueAfterFailure = true
        // Passés par xcodebuild : `TEST_RUNNER_AGENT_HOST=<ip du Mac> xcodebuild test …`
        // (le préfixe TEST_RUNNER_ est retiré à l'arrivée dans le processus de test).
        let env = ProcessInfo.processInfo.environment
        let host = env["AGENT_HOST"] ?? "127.0.0.1"
        let port = UInt16(env["AGENT_PORT"] ?? "") ?? 8765
        let link = try Link(host: host, port: port)
        let app = XCUIApplication(bundleIdentifier: env["AGENT_BUNDLE"] ?? "com.tentacle.mobile")
        let remote = XCUIRemote.shared
        link.sendHeader(["hello": true])

        while let line = link.readLine() {
            guard let data = line.data(using: .utf8),
                  let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let action = obj["a"] as? String else { continue }
            let id = obj["id"] as? Int ?? 0
            let seconds = obj["s"] as? Double
            var payload = Data()
            var kind = "none"
            var info = ""
            let started = Date()

            switch action {
            case "up": remote.press(.up)
            case "down": remote.press(.down)
            case "left": remote.press(.left)
            case "right": remote.press(.right)
            case "select": remote.press(.select)
            case "menu": remote.press(.menu)
            case "play": remote.press(.playPause)
            case "home": remote.press(.home)
            case "hold": remote.press(.select, forDuration: seconds ?? 1.0)
            case "holdright": remote.press(.right, forDuration: seconds ?? 1.0)
            case "holdleft": remote.press(.left, forDuration: seconds ?? 1.0)
            case "holddown": remote.press(.down, forDuration: seconds ?? 1.0)
            case "holdup": remote.press(.up, forDuration: seconds ?? 1.0)
            case "activate": app.activate()
            case "type": app.typeText(obj["t"] as? String ?? "")
            case "wait": Thread.sleep(forTimeInterval: seconds ?? 0.5)
            case "shot":
                let shot = XCUIScreen.main.screenshot()
                payload = jpeg(shot.image, width: (obj["w"] as? Double) ?? 1920)
                kind = "jpg"
            // Une application passée en arrière-plan (Menu à la racine renvoie à
            // l'accueil de tvOS) est suspendue : l'interroger bloquait 3 × 31 s,
            // puis l'échec clôturait le test — et le démontage tuait l'appli.
            case "tree" where app.state != .runningForeground,
                 "focus" where app.state != .runningForeground:
                info = "background:\(app.state.rawValue)"
            case "tree":
                payload = app.debugDescription.data(using: .utf8) ?? Data()
                kind = "txt"
            case "focus":
                let el = app.descendants(matching: .any)
                    .matching(NSPredicate(format: "hasFocus == true")).firstMatch
                if el.exists {
                    info = "\(el.elementType.rawValue)|\(el.label)|\(el.identifier)|\(NSCoder.string(for: el.frame))"
                } else {
                    info = "none"
                }
            case "quit":
                link.sendHeader(["id": id, "ok": true])
                return
            default:
                info = "unknown:\(action)"
            }

            let ms = Int(Date().timeIntervalSince(started) * 1000)
            link.sendHeader(["id": id, "ok": true, "kind": kind, "len": payload.count, "info": info, "ms": ms])
            if !payload.isEmpty { link.send(payload) }
        }
    }
}

/// XCTest attend que l'application soit « au repos » après chaque appui — une
/// application React Native ne l'est presque jamais (minuteurs, animations) et
/// chaque appui coûterait des dizaines de secondes. On neutralise l'attente.
private func disableQuiescence() {
    guard let cls = NSClassFromString("XCUIApplicationProcess") else { return }
    let one = NSSelectorFromString("waitForQuiescenceIncludingAnimationsIdle:")
    if let m = class_getInstanceMethod(cls, one) {
        let block: @convention(block) (AnyObject, Bool) -> Void = { _, _ in }
        method_setImplementation(m, imp_implementationWithBlock(block))
    }
    let two = NSSelectorFromString("waitForQuiescenceIncludingAnimationsIdle:isPreEvent:")
    if let m = class_getInstanceMethod(cls, two) {
        let block: @convention(block) (AnyObject, Bool, Bool) -> Void = { _, _, _ in }
        method_setImplementation(m, imp_implementationWithBlock(block))
    }
}

private func jpeg(_ image: UIImage, width: Double) -> Data {
    let ratio = image.size.height / image.size.width
    let target = CGSize(width: width, height: (width * ratio).rounded())
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: target, format: format)
    return renderer.jpegData(withCompressionQuality: 0.82) { _ in
        image.draw(in: CGRect(origin: .zero, size: target))
    }
}

/// Liaison TCP brute (Network.framework) : ATS ne s'applique pas, et un seul
/// flux suffit — l'agent lit une commande, répond, recommence.
final class Link {
    private let conn: NWConnection
    private var buffer = Data()

    init(host: String, port: UInt16) throws {
        conn = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
        let sem = DispatchSemaphore(value: 0)
        var failure: Error?
        conn.stateUpdateHandler = { state in
            switch state {
            case .ready: sem.signal()
            case .failed(let error): failure = error; sem.signal()
            default: break
            }
        }
        conn.start(queue: DispatchQueue(label: "atv-agent.link"))
        if sem.wait(timeout: .now() + 20) == .timedOut {
            throw NSError(domain: "atv-agent", code: 1, userInfo: [NSLocalizedDescriptionKey: "connexion au Mac impossible"])
        }
        if let failure { throw failure }
    }

    func readLine() -> String? {
        while true {
            if let idx = buffer.firstIndex(of: 0x0A) {
                let lineData = buffer.subdata(in: buffer.startIndex..<idx)
                buffer.removeSubrange(buffer.startIndex...idx)
                return String(data: lineData, encoding: .utf8)
            }
            let sem = DispatchSemaphore(value: 0)
            var chunk: Data?
            var finished = false
            conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, isComplete, error in
                chunk = data
                finished = isComplete || error != nil
                sem.signal()
            }
            // Le fil principal ne doit jamais bloquer : en arrière-plan, le chien
            // de garde de FrontBoard tue le lanceur au bout de 10 s sans réponse
            // aux mises à jour de scène (simulateur tvOS 26, 0x8BADF00D).
            while sem.wait(timeout: .now()) == .timedOut {
                RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
            }
            if let chunk, !chunk.isEmpty { buffer.append(chunk) } else if finished { return nil }
        }
    }

    func send(_ data: Data) {
        let sem = DispatchSemaphore(value: 0)
        conn.send(content: data, completion: .contentProcessed { _ in sem.signal() })
        sem.wait()
    }

    func sendHeader(_ obj: [String: Any]) {
        var data = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data()
        data.append(0x0A)
        send(data)
    }
}
