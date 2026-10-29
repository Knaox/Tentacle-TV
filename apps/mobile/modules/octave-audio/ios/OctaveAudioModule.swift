import ExpoModulesCore
import UIKit

/// Le module Expo « OctaveAudio » : la porte du pont audio (`../README.md`). Une commande, ses arguments en
/// JSON ; un évènement, `onBridgeEvent`. Tout le travail se fait sur la file du moteur.
public class OctaveAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OctaveAudio")

    Events("onBridgeEvent")

    // Ce build lit un flux DIRECT (`open: "direct"`, repli `fallbackUrl`) : la page peut l'adopter.
    Constants(["directStreams": true])

    OnCreate {
      OctaveAudioEngine.shared.emit = { [weak self] json in
        self?.sendEvent("onBridgeEvent", ["json": json])
      }
      OctaveAudioModule.watchTermination()
    }

    // Le lancement en cours (ce processus) : la reprise du lecteur ne vaut que dans le même.
    Function("launchId") { OctaveAudioEngine.launchId }

    AsyncFunction("invoke") { (command: String, argsJson: String, promise: Promise) in
      let engine = OctaveAudioEngine.shared
      engine.queue.async {
        let result = engine.handle(command, BridgeJson.parse(argsJson))
        promise.resolve(result.map { BridgeJson.string($0) } ?? "")
      }
    }
  }

  /// L'application balayée pendant l'écoute : la musique s'arrête et l'écran verrouillé se vide (`terminate`).
  private static var terminationObserver: NSObjectProtocol?

  private static func watchTermination() {
    guard terminationObserver == nil else { return }
    terminationObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willTerminateNotification, object: nil, queue: .main
    ) { _ in
      OctaveAudioEngine.shared.terminate()
    }
  }
}
